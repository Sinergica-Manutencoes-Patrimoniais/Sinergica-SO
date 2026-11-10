import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { conferirToleranciasLote, incorporarLinhaCronograma, listarMapeamentosCronograma, prepararImportacaoCronograma, type PedidoIncorporacaoCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";
import { ReprocessarLinha } from "./ReprocessarLinha";
import { IncorporarLote } from "./IncorporarLote";

export function IncorporarLinha({ userId, clienteId, loteId }: { userId: string; clienteId: string; loteId: string }) {
  const cache = useQueryClient(); const storageKey = `sso-incorporacao-cronograma:${JSON.stringify([userId, clienteId, loteId])}`;
  const trava = useRef(false);
  const [planoId, setPlanoId] = useState(""); const [aviso, setAviso] = useState("");
  const [linhaSelecionada,setLinhaSelecionada] = useState<string | null>(null); const [confirmacao,setConfirmacao]=useState<string | null>(null);
  const [pendente, setPendente] = useState<PedidoIncorporacaoCronograma | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as PedidoIncorporacaoCronograma;
    return p.clienteId === clienteId && p.loteId === loteId && typeof p.planoId === "string" && typeof p.chave === "string" && typeof p.requestId === "string" && typeof p.rotinaId === "string" && Number.isSafeInteger(p.loteRevision) && Number.isSafeInteger(p.planoRevision) ? p : "invalido";
  } catch { return "invalido"; } });
  async function conferirSessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const planos = useInfiniteQuery({ queryKey: ["planos-importacao", userId, clienteId], initialPageParam: null as string | null, gcTime: 0,
    queryFn: async ({ pageParam, signal }) => { await conferirSessao(signal); const pagina = await supabasePlanoManutencaoAdapter.listarPlanos(clienteId, 50, pageParam, signal); await conferirSessao(signal); return pagina; },
    getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.id : undefined });
  const linhas = useInfiniteQuery({ queryKey: ["candidatos-importacao", userId, clienteId, loteId, planoId], enabled: !!planoId, gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessao(signal); const pagina = await prepararImportacaoCronograma(clienteId, loteId, planoId, pageParam, signal); await conferirSessao(signal); return pagina; }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.chave : undefined });
  const mapeamentos = useInfiniteQuery({ queryKey: ["importacao-plano", userId, clienteId, "mapeamentos", loteId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessao(signal); const pagina = await listarMapeamentosCronograma(clienteId, loteId, pageParam, signal); await conferirSessao(signal); return pagina; }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.chave : undefined });
  const planosCarregados = planos.data?.pages.flat() ?? [];
  const linhasCarregadas = linhas.data?.pages.flat() ?? [];
  const mapasCarregados = mapeamentos.data?.pages.flat() ?? [];
  const consistentes = new Set(planosCarregados.map((p) => p.id.toLowerCase())).size === planosCarregados.length &&
    planosCarregados.every((p) => p.clienteId.toLowerCase() === clienteId.toLowerCase()) &&
    new Set(linhasCarregadas.map((l) => l.chave)).size === linhasCarregadas.length &&
    new Set(mapasCarregados.map((m) => m.chave)).size === mapasCarregados.length &&
    new Set(mapasCarregados.map((m) => m.id.toLowerCase())).size === mapasCarregados.length;
  const linhaAtual=linhas.data?.pages.flat().find((l)=>l.chave===linhaSelecionada && l.candidata);
  const mapaAtual=mapeamentos.data?.pages.flat().find((m)=>m.id===linhaAtual?.mapeamento_id && m.chave===linhaAtual?.chave);
  const toleranciaHabilitada=import.meta.env.VITE_SSO_CONFERENCIA_TOLERANCIAS_LOTE_ENABLED === "true";
  const tolerancia=useQuery({queryKey:["cronograma-tolerancias-individual",userId,clienteId,loteId,linhaAtual?.revisao_lote,mapaAtual?.id],gcTime:0,retry:false,
    enabled:toleranciaHabilitada&&consistentes&&!!linhaAtual&&!!mapaAtual&&!linhas.isFetching&&!linhas.isError&&!mapeamentos.isFetching&&!mapeamentos.isError,
    queryFn:({signal})=>conferirToleranciasLote(userId,clienteId,loteId,linhaAtual!.revisao_lote,[mapaAtual!.id],signal)});
  const toleranciaAtual=!tolerancia.isFetching&&!tolerancia.isError&&tolerancia.data?.length===1?tolerancia.data[0]:undefined;
  const fotografia=JSON.stringify({clienteId,loteId,planoId,linha:linhaAtual,mapa:mapaAtual,tolerancia:toleranciaAtual});
  const envio = useMutation({ mutationFn: async (p: PedidoIncorporacaoCronograma) => {
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa alterada.");
    const resultado = await incorporarLinhaCronograma(p);
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    return resultado;
  }, onSuccess: async (_resultado,p) => { try {
    await cache.invalidateQueries({ queryKey: ["candidatos-importacao", userId, clienteId, loteId] });
    await cache.invalidateQueries({ queryKey: ["planos-importacao", userId, clienteId] });
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa alterada.");
    sessionStorage.removeItem(storageKey);
    setPendente(null); setAviso("Rotina criada em rascunho; nenhuma ocorrência ou OS foi gerada.");
  } catch { setAviso("Rotina registrada, mas tentativa local não pôde ser removida; procure suporte."); }
  }, onError: () => setAviso("Resultado não confirmado: revisão, identidade, gate ou autorização podem impedir. Repita a mesma tentativa; procure suporte em conflito."), onSettled: () => { trava.current = false; } });
  const enviar = (p: PedidoIncorporacaoCronograma, repetir = false) => { if (trava.current) return; try {
    const salva = sessionStorage.getItem(storageKey);
    if ((repetir && salva !== JSON.stringify(p)) || (!repetir && salva !== null)) throw new Error("Tentativa divergente.");
    if (!repetir) sessionStorage.setItem(storageKey, JSON.stringify(p));
  } catch { setAviso("Não foi possível conferir ou guardar tentativa; nada enviado."); return; } setPendente(p); trava.current = true; envio.mutate(p); };
  return <section aria-label="Incorporação ao Plano rascunho"><h4>Incorporar linha a Plano rascunho</h4>
    <p>Uma linha por vez; exige lote aprovado e revisão atual. A identidade já incorporada é bloqueada. Não aprova Plano nem gera ocorrência, OS ou ação no Auvo.</p>
    {!consistentes && <p role="alert">Dados repetidos ou Cliente divergente. <button type="button" onClick={() => { void planos.refetch(); void linhas.refetch(); void mapeamentos.refetch(); }}>Reconsultar</button></p>}
    <label>Plano rascunho <select value={planoId} disabled={!!pendente || !consistentes || planos.isFetching || planos.isError} onChange={(e) => {setPlanoId(e.target.value);setLinhaSelecionada(null);setConfirmacao(null);}}><option value="">Selecione</option>{consistentes && planosCarregados.filter((p) => p.estado === "rascunho").map((p) => <option key={p.id} value={p.id}>{p.nome} · revisão {p.revisao}</option>)}</select></label>
    {planos.isError && <p role="alert">Não foi possível consultar Planos. <button type="button" onClick={() => void planos.refetch()}>Tentar novamente</button></p>}
    {planos.hasNextPage && <button type="button" onClick={() => void planos.fetchNextPage()}>Mais Planos</button>}
    {linhas.isError && <p role="alert">Lote sem aprovação atual, Plano indisponível ou consulta falhou. <button type="button" onClick={() => void linhas.refetch()}>Tentar novamente</button></p>}
    {mapeamentos.isError && <p role="alert">Mapeamentos indisponíveis. <button type="button" onClick={() => void mapeamentos.refetch()}>Tentar novamente</button></p>}
    {consistentes && linhas.data && !linhas.isError && !linhas.isFetching && <ul>{linhas.data.pages.flat().filter((l) => l.candidata).map((l) => {
      const m = mapeamentos.data?.pages.flat().find((x) => x.id === l.mapeamento_id);
      return <li key={l.chave}>Linha {l.chave} · identidade {l.identidade ?? "ausente"} · {m ? `${m.nome} · ${m.alvoTipo} ${m.alvoId} · ${m.modo}` : "carregue o mapeamento correspondente"} · alvo {l.alvo_atual} · pendências {l.pendencias.join(", ") || "nenhuma detectada"}
        <button type="button" disabled={!!pendente || envio.isPending || linhas.isFetching || planos.isFetching || planos.isError || mapeamentos.isFetching || mapeamentos.isError || !m || l.alvo_atual !== "valido" || l.pendencias.length > 0} onClick={() => {setLinhaSelecionada(l.chave);setConfirmacao(null);}}>Conferir linha</button></li>;
    })}</ul>}
    {linhas.hasNextPage && <button type="button" onClick={() => void linhas.fetchNextPage()}>Mais linhas</button>}
    {mapeamentos.hasNextPage && <button type="button" onClick={() => void mapeamentos.fetchNextPage()}>Mais mapeamentos</button>}
    {linhaSelecionada && <section aria-label="Conferência da linha selecionada">
      {!toleranciaHabilitada && <p>A conferência de tolerâncias está indisponível; criação permanece bloqueada.</p>}
      {tolerancia.isFetching && <output>Consultando tolerâncias…</output>}
      {tolerancia.isError && <p role="alert">Tolerância indisponível ou lote alterado. <button type="button" onClick={()=>void tolerancia.refetch()}>Tentar novamente</button></p>}
      {consistentes && linhaAtual && mapaAtual && toleranciaAtual && !linhas.isFetching && !linhas.isError && !mapeamentos.isFetching && !mapeamentos.isError && <>
        <p>Linha {linhaAtual.chave} · {mapaAtual.nome} · disciplina {mapaAtual.disciplina} · {mapaAtual.alvoTipo} {mapaAtual.alvoId} · {mapaAtual.modo} · intervalo {mapaAtual.intervalo} {mapaAtual.unidade} · data-base {mapaAtual.dataBase ?? "não informada"} · {mapaAtual.tempoMinutos === null ? "Tempo a validar" : `${mapaAtual.tempoMinutos} minutos`} · premissa {mapaAtual.premissaMensal} · tolerância {toleranciaAtual.antes} dias antes e {toleranciaAtual.depois} depois{toleranciaAtual.configurada ? "" : " (padrão)"}.</p>
        {confirmacao && confirmacao!==fotografia && <p role="alert">Dados alterados; confira novamente.</p>}
        <label><input type="checkbox" checked={confirmacao===fotografia} disabled={!!pendente||envio.isPending||planos.isFetching||planos.isError} onChange={(e)=>setConfirmacao(e.target.checked?fotografia:null)} /> Conferi os dados e tolerâncias desta linha.</label>
        <button type="button" disabled={confirmacao!==fotografia||!!pendente||envio.isPending||planos.isFetching||planos.isError||linhaAtual.alvo_atual!=="valido"||linhaAtual.pendencias.length>0} onClick={()=>enviar({requestId:crypto.randomUUID(),clienteId,loteId,loteRevision:linhaAtual.revisao_lote,chave:linhaAtual.chave,planoId,planoRevision:linhaAtual.revisao_plano,rotinaId:crypto.randomUUID()})}>Criar Rotina rascunho</button>
      </>}
    </section>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente,true)}>Repetir tentativa pendente</button>}
    {aviso && <p role="status">{aviso}</p>}
    {consistentes && planoId && import.meta.env.VITE_SSO_REPROCESSAR_CRONOGRAMA_ENABLED === "true" && <ReprocessarLinha key={planoId} userId={userId} clienteId={clienteId} loteId={loteId} planoId={planoId} />}
    {consistentes && planoId && import.meta.env.VITE_SSO_INCORPORAR_LOTE_CRONOGRAMA_ENABLED === "true" && <IncorporarLote key={planoId} userId={userId} clienteId={clienteId} loteId={loteId} planoId={planoId} />}
  </section>;
}
