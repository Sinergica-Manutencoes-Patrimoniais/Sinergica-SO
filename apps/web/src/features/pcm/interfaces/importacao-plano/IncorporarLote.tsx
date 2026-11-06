import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { conferirToleranciasLote, incorporarLoteCronograma, listarMapeamentosCronograma, prepararImportacaoCronograma, type PedidoLoteCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";

export function IncorporarLote({ userId, clienteId, loteId, planoId }: { userId: string; clienteId: string; loteId: string; planoId: string }) {
  const cache = useQueryClient(); const storageKey = `sso-incorporacao-lote-cronograma:${JSON.stringify([userId, clienteId, loteId, planoId])}`;
  const trava = useRef(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]); const [confirmado, setConfirmado] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<PedidoLoteCronograma | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as PedidoLoteCronograma;
    return p.clienteId === clienteId && p.loteId === loteId && p.planoId === planoId && typeof p.requestId === "string" && Number.isSafeInteger(p.loteRevision) && Number.isSafeInteger(p.planoRevision) && Array.isArray(p.linhas) && p.linhas.length > 0 && p.linhas.length <= 25 && p.linhas.every((l) => typeof l.chave === "string" && typeof l.rotinaId === "string") ? p : "invalido";
  } catch { return "invalido"; } });
  async function conferirSessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const candidatos = useInfiniteQuery({ queryKey: ["candidatos-importacao", userId, clienteId, loteId, planoId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessao(signal); const pagina = await prepararImportacaoCronograma(clienteId, loteId, planoId, pageParam, signal); await conferirSessao(signal); return pagina; }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.chave : undefined });
  const mapeamentos = useInfiniteQuery({ queryKey: ["importacao-plano", userId, clienteId, "mapeamentos", loteId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessao(signal); const pagina = await listarMapeamentosCronograma(clienteId, loteId, pageParam, signal); await conferirSessao(signal); return pagina; }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.chave : undefined });
  const envio = useMutation({ mutationFn: async (p: PedidoLoteCronograma) => {
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");
    const resultado=await incorporarLoteCronograma(p);const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");return resultado;
  }, onSuccess: async (_,p) => { try {
    await cache.invalidateQueries({ queryKey: ["candidatos-importacao", userId, clienteId, loteId, planoId] }); await cache.invalidateQueries({ queryKey: ["planos-importacao", userId, clienteId] });
    const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Sessão ou tentativa alterada.");sessionStorage.removeItem(storageKey);
    setPendente(null); setSelecionadas([]); setConfirmado(null); setAviso("Lote incorporado em rascunho; nenhuma ocorrência ou OS foi criada.");
  } catch { setAviso("Operação confirmada, mas tentativa local não pôde ser removida; procure suporte."); }
  }, onError: () => setAviso("Resultado não confirmado ou lote recusado. A operação é atômica; repita a mesma tentativa e procure suporte em conflito."), onSettled:()=>{trava.current=false;} });
  const enviar = (p: PedidoLoteCronograma, repetir=false) => { if(trava.current)return;try { const salva=sessionStorage.getItem(storageKey);if((repetir&&salva!==JSON.stringify(p))||(!repetir&&salva!==null))throw new Error("Tentativa divergente.");if(!repetir)sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Não foi possível conferir ou guardar tentativa; nada enviado."); return; } setPendente(p);trava.current=true;envio.mutate(p); };
  const todas = candidatos.data?.pages.flat() ?? []; const escolhidas = todas.filter((x) => selecionadas.includes(x.chave));
  const mapas = mapeamentos.data?.pages.flat() ?? [];
  const consistentes = new Set(todas.map((x) => x.chave)).size === todas.length && new Set(mapas.map((x) => x.chave)).size === mapas.length && new Set(mapas.map((x) => x.id)).size === mapas.length;
  const mapasEscolhidos = escolhidas.map((x) => mapas.find((m) => m.id === x.mapeamento_id && m.chave === x.chave) ?? null);
  const primeira = escolhidas[0];
  const revisaoUnica = consistentes && !!primeira && escolhidas.length === selecionadas.length && escolhidas.every((x) => x.revisao_lote === primeira.revisao_lote && x.revisao_plano === primeira.revisao_plano && x.candidata && x.alvo_atual === "valido" && x.pendencias.length === 0);
  const mapasConferiveis = mapasEscolhidos.length === escolhidas.length && mapasEscolhidos.every(Boolean) && !mapeamentos.isFetching && !mapeamentos.isError;
  const toleranciaHabilitada=import.meta.env.VITE_SSO_CONFERENCIA_TOLERANCIAS_LOTE_ENABLED === "true";
  const idsMapas=mapasEscolhidos.flatMap((x)=>x?[x.id]:[]).sort();
  const tolerancias=useQuery({queryKey:["cronograma-tolerancias-lote",userId,clienteId,loteId,primeira?.revisao_lote,idsMapas],gcTime:0,retry:false,
    enabled:toleranciaHabilitada&&revisaoUnica&&mapasConferiveis&&idsMapas.length>0,
    queryFn:({signal})=>conferirToleranciasLote(userId,clienteId,loteId,primeira!.revisao_lote,idsMapas,signal)});
  const toleranciasDisponiveis=toleranciaHabilitada&&!tolerancias.isFetching&&!tolerancias.isError&&tolerancias.data?.length===idsMapas.length&&idsMapas.length>0;
  const fotografia=JSON.stringify({clienteId,loteId,planoId,linhas:escolhidas,mapeamentos:mapasEscolhidos,tolerancias:tolerancias.data});
  return <section aria-label="Incorporação atômica de linhas"><h4>Incorporar várias linhas</h4>
    <p>Selecione até 25 linhas após conferir seus mapeamentos. Todas são incorporadas em uma transação ou nenhuma; não cria ocorrência, OS ou tarefa no Auvo.</p>
    {candidatos.isError && <p role="alert">Candidatos indisponíveis. <button type="button" onClick={() => void candidatos.refetch()}>Tentar novamente</button></p>}
    {mapeamentos.isError && <p role="alert">Mapeamentos indisponíveis. <button type="button" onClick={() => void mapeamentos.refetch()}>Tentar novamente</button></p>}
    {!consistentes && <p role="alert">Páginas de linhas ou mapeamentos divergentes. <button type="button" onClick={() => { void candidatos.refetch(); void mapeamentos.refetch(); }}>Reconsultar</button></p>}
    {toleranciaHabilitada && tolerancias.isError && <p role="alert">Tolerâncias indisponíveis ou lote alterado. <button type="button" onClick={() => void tolerancias.refetch()}>Tentar novamente</button></p>}
    {candidatos.data && !candidatos.isFetching && !candidatos.isError && consistentes && <ul>{todas.filter((x) => x.candidata).map((x) => <li key={x.chave}><label><input type="checkbox" checked={selecionadas.includes(x.chave)} disabled={!!pendente || envio.isPending || x.alvo_atual !== "valido" || x.pendencias.length > 0 || (!selecionadas.includes(x.chave) && selecionadas.length >= 25)} onChange={(e) => { setConfirmado(null); setSelecionadas(e.target.checked ? [...selecionadas, x.chave] : selecionadas.filter((k) => k !== x.chave)); }} /> Linha {x.chave} · identidade {x.identidade ?? "ausente"} · alvo {x.alvo_atual} · {x.pendencias.join(", ") || "sem pendências detectadas"}</label></li>)}</ul>}
    {candidatos.hasNextPage && <button type="button" onClick={() => void candidatos.fetchNextPage()}>Mais linhas</button>}
    {mapeamentos.hasNextPage && <button type="button" disabled={mapeamentos.isFetching} onClick={() => void mapeamentos.fetchNextPage()}>Mais mapeamentos</button>}
    <p>{selecionadas.length} de 25 linhas selecionadas.</p>
    {escolhidas.length>0 && !mapeamentos.isFetching && !mapeamentos.isError && <ul aria-label="Mapeamentos das linhas selecionadas">{escolhidas.map((linha,indice)=>{
      const mapa=mapasEscolhidos[indice];const tolerancia=toleranciasDisponiveis?tolerancias.data?.find((t)=>t.id===mapa?.id):undefined;return <li key={linha.chave}>Linha {linha.chave}: {mapa ? <>{mapa.nome} · disciplina {mapa.disciplina} · {mapa.alvoTipo} {mapa.alvoId} · modo {mapa.modo} · intervalo {mapa.intervalo} {mapa.unidade} · data-base {mapa.dataBase ?? "não informada"} · {mapa.tempoMinutos === null ? "Tempo a validar" : `${mapa.tempoMinutos} minutos`} · premissa mensal {mapa.premissaMensal} · tolerância {tolerancia ? `${tolerancia.antes} dias antes e ${tolerancia.depois} depois${tolerancia.configurada ? "" : " (padrão)"}` : "não conferida"}</> : "mapeamento não carregado; carregue mais ou atualize"}</li>;
    })}</ul>}
    {!toleranciaHabilitada && <p>A conferência conjunta de tolerâncias está indisponível; incorporação em lote permanece bloqueada.</p>}
    {confirmado && confirmado!==fotografia && <p role="alert">A seleção ou os dados mudaram; confira novamente.</p>}<label><input type="checkbox" checked={confirmado===fotografia} disabled={!revisaoUnica || !mapasConferiveis || !toleranciasDisponiveis || !!pendente || candidatos.isFetching || candidatos.isError} onChange={(e) => setConfirmado(e.target.checked?fotografia:null)} /> Conferi os mapeamentos e tolerâncias e autorizo incorporar estas linhas ao Plano rascunho</label>{" "}
    <button type="button" disabled={confirmado!==fotografia || !revisaoUnica || !mapasConferiveis || !toleranciasDisponiveis || !!pendente || envio.isPending || candidatos.isFetching || candidatos.isError} onClick={() => { if (primeira) enviar({ requestId: crypto.randomUUID(), clienteId, loteId, loteRevision: primeira.revisao_lote, planoId, planoRevision: primeira.revisao_plano, linhas: escolhidas.map((x) => ({ chave: x.chave, rotinaId: crypto.randomUUID() })) }); }}>Incorporar lote</button>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente,true)}>Repetir tentativa pendente</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
