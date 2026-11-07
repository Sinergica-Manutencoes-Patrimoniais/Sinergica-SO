import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@sinergica/ui";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { aplicarReprocessamentoCronograma, listarPropostasReprocessamento, prepararImportacaoCronograma, proporReprocessamentoCronograma, type PedidoAplicacaoReprocessamento, type PedidoPropostaReprocessamento } from "../../infrastructure/supabase-importacao-plano-adapter";
type Tentativa = { tipo: "proposta"; pedido: PedidoPropostaReprocessamento } | { tipo: "aplicacao"; pedido: PedidoAplicacaoReprocessamento };

export function ReprocessarLinha({ userId, clienteId, loteId, planoId }: { userId: string; clienteId: string; loteId: string; planoId: string }) {
  const cache = useQueryClient(); const storageKey = `sso-reprocessamento-cronograma:${JSON.stringify([userId, clienteId, loteId, planoId])}`;
  const trava = useRef(false);
  const [chave, setChave] = useState(""); const [motivo, setMotivo] = useState(""); const [confirmado, setConfirmado] = useState(""); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Tentativa | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const v = JSON.parse(raw) as Tentativa;
    if (v.tipo === "proposta" && v.pedido.clienteId === clienteId && v.pedido.loteId === loteId && v.pedido.planoId === planoId && typeof v.pedido.requestId === "string" && typeof v.pedido.chave === "string" && typeof v.pedido.justificativa === "string" && Number.isSafeInteger(v.pedido.loteRevision) && Number.isSafeInteger(v.pedido.planoRevision)) return v;
    if (v.tipo === "aplicacao" && v.pedido.clienteId === clienteId && typeof v.pedido.requestId === "string" && typeof v.pedido.propostaId === "string") return v;
    return "invalido";
  } catch { return "invalido"; } });
  const propostas = useInfiniteQuery({ queryKey: ["propostas-reprocessamento", userId, clienteId, loteId, planoId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listarPropostasReprocessamento(clienteId, loteId, planoId, pageParam, signal), getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.id : undefined });
  const linhas = useInfiniteQuery({ queryKey: ["candidatos-importacao", userId, clienteId, loteId, planoId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => prepararImportacaoCronograma(clienteId, loteId, planoId, pageParam, signal), getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.chave : undefined });
  const envio = useMutation({ mutationFn: async (v: Tentativa) => {
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||sessionStorage.getItem(storageKey)!==JSON.stringify(v))throw new Error("Sessão ou tentativa alterada.");
    const resultado=await (v.tipo === "proposta" ? proporReprocessamentoCronograma(v.pedido) : aplicarReprocessamentoCronograma(v.pedido));
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");return resultado;
  }, onSuccess: async (_, v) => {
    try { await cache.invalidateQueries({ queryKey: ["propostas-reprocessamento", userId, clienteId, loteId, planoId] }); await cache.invalidateQueries({ queryKey: ["candidatos-importacao", userId, clienteId, loteId, planoId] }); await cache.invalidateQueries({ queryKey: ["planos-importacao", userId, clienteId] });
      const atual=await supabase.auth.getUser();if(atual.error||atual.data.user?.id!==userId||sessionStorage.getItem(storageKey)!==JSON.stringify(v))throw new Error("Sessão ou tentativa alterada.");sessionStorage.removeItem(storageKey);
      setPendente(null); setConfirmado(""); setAviso(v.tipo === "proposta" ? "Proposta registrada; a Rotina não foi alterada." : "Proposta aplicada à Rotina rascunho; nenhuma OS ou ocorrência foi gerada.");
    } catch { setAviso("Operação confirmada, mas tentativa local não pôde ser removida; procure suporte."); }
  }, onError: () => setAviso("Resultado não confirmado, revisão ou identidade pode ter mudado. Repita a mesma tentativa e procure suporte em conflito."), onSettled:()=>{trava.current=false;} });
  const enviar = (v: Tentativa,repetir=false) => { if(trava.current)return;try { const salva=sessionStorage.getItem(storageKey);if((repetir&&salva!==JSON.stringify(v))||(!repetir&&salva!==null))throw new Error("Tentativa divergente.");if(!repetir)sessionStorage.setItem(storageKey, JSON.stringify(v)); } catch { setAviso("Não foi possível conferir ou guardar tentativa; nada enviado."); return; } setPendente(v);trava.current=true;envio.mutate(v); };
  const linha = linhas.data?.pages.flat().find((l) => l.chave === chave && l.candidata);
  return <section aria-label="Reprocessamento de Rotina"><h4>Reprocessar identidade já incorporada</h4>
    <p>Propor não altera a Rotina. Compare os dados e confirme explicitamente antes de aplicar; o servidor revalida revisão, versão e fonte.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (!linha || pendente || !motivo.trim() || linhas.isFetching || linhas.isError) return;
      enviar({ tipo: "proposta", pedido: { requestId: crypto.randomUUID(), clienteId, loteId, loteRevision: linha.revisao_lote, chave: linha.chave, planoId, planoRevision: linha.revisao_plano, justificativa: motivo.trim() } }); }}>
      <fieldset disabled={!!pendente || envio.isPending}><label>Linha candidata <select required value={chave} onChange={(e) => setChave(e.target.value)}><option value="">Selecione</option>{linhas.data?.pages.flat().filter((l) => l.candidata).map((l) => <option key={l.chave} value={l.chave}>{l.chave} · {l.identidade ?? "sem identidade"}</option>)}</select></label>{" "}
      <label>Justificativa <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label><button type="submit" disabled={!linha || linhas.isFetching || linhas.isError}>Propor comparação</button></fieldset>
    </form>
    {linhas.isError && <p role="alert">Não foi possível consultar candidatos. <button type="button" onClick={() => void linhas.refetch()}>Tentar novamente</button></p>}
    {linhas.hasNextPage && <button type="button" onClick={() => void linhas.fetchNextPage()}>Mais linhas</button>}
    {propostas.isError && <p role="alert">Não foi possível consultar propostas. <button type="button" onClick={() => void propostas.refetch()}>Tentar novamente</button></p>}
    {propostas.data && !propostas.isFetching && !propostas.isError && <ul>{propostas.data.pages.flat().map((p) => <li key={p.id}>Linha {p.chave_linha} · Rotina {p.rotina_id} · revisões lote {p.revisao_lote}, Plano {p.revisao_plano} · {p.aplicada ? "aplicada" : "pendente"}<p>Motivo: {p.justificativa}</p>
      <DataTable<string> itens={Object.keys(p.antes)} chaveLinha={(k) => k} vazio="Nenhum campo para comparar." colunas={[{ chave: "campo", cabecalho: "Campo", cabecalhoLinha: true, render: (k) => k }, { chave: "atual", cabecalho: "Atual na proposta", render: (k) => String(p.antes[k] ?? "—") }, { chave: "proposto", cabecalho: "Proposto", render: (k) => String(p.depois[k] ?? "—") }]} />
      {!p.aplicada && <><label><input type="checkbox" checked={confirmado === JSON.stringify(p)} onChange={(e) => setConfirmado(e.target.checked ? JSON.stringify(p) : "")} /> Conferi os valores e autorizo esta alteração da Rotina rascunho</label>{" "}
      <button type="button" disabled={confirmado !== JSON.stringify(p) || !!pendente || envio.isPending || propostas.isFetching || propostas.isError} onClick={() => enviar({ tipo: "aplicacao", pedido: { requestId: crypto.randomUUID(), clienteId, propostaId: p.id } })}>Aplicar proposta</button></>}</li>)}</ul>}
    {propostas.hasNextPage && <button type="button" onClick={() => void propostas.fetchNextPage()}>Mais propostas</button>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente,true)}>Repetir tentativa pendente</button>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
