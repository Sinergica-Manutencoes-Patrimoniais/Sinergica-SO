import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listarRevisoesLinhaCronograma, revisarLinhaCronograma, type PedidoRevisaoLinhaCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";

export function RevisaoLinha({ userId, clienteId, loteId, revisao }: { userId: string; clienteId: string; loteId: string; revisao: number }) {
  const storageKey = `sso-revisao-cronograma:${JSON.stringify([userId, clienteId, loteId])}`;
  const cache = useQueryClient(); const [chave, setChave] = useState(""); const [consultada, setConsultada] = useState("");
  const [estado, setEstado] = useState<"em_revisao" | "rejeitada">("em_revisao"); const [motivo, setMotivo] = useState(""); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<PedidoRevisaoLinhaCronograma | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as PedidoRevisaoLinhaCronograma;
      return p.loteId === loteId && typeof p.requestId === "string" && Number.isSafeInteger(p.expectedRevision) && typeof p.chaveLinha === "string" && (p.estado === "em_revisao" || p.estado === "rejeitada") && typeof p.justificativa === "string" ? p : "invalido";
    } catch { return "invalido"; }
  });
  const historico = useInfiniteQuery({ queryKey: ["revisoes-cronograma", userId, clienteId, loteId, consultada], enabled: !!consultada, gcTime: 0,
    initialPageParam: null as number | null, queryFn: ({ pageParam, signal }) => listarRevisoesLinhaCronograma(clienteId, loteId, consultada, pageParam, signal),
    getNextPageParam: (page) => page.length === 20 ? page.at(-1)?.revisao_lote : undefined });
  const envio = useMutation({ mutationFn: revisarLinhaCronograma, onSuccess: async () => {
    await Promise.all([cache.invalidateQueries({ queryKey: ["conferencia-integrada-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["diagnostico-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["revisoes-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["importacao-plano", userId, clienteId, "lotes"] })]);
    try { sessionStorage.removeItem(storageKey); } catch { setAviso("Registro concluído, mas não foi possível limpar tentativa local; procure suporte."); return; }
    setPendente(null); setAviso("Declaração registrada em staging. Não houve aprovação nem incorporação.");
  }, onError: () => setAviso("Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; em caso de conflito, procure suporte.") });
  const enviar = (p: PedidoRevisaoLinhaCronograma) => { try { sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar tentativa; nada enviado."); return; } setPendente(p); envio.mutate(p); };
  return <section aria-label="Revisão de linha"><h4>Revisão de linha</h4><p>Declaração auditada: não aprova o lote nem cria dados oficiais.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || !chave.trim() || !motivo.trim()) return;
      enviar({ requestId: crypto.randomUUID(), loteId, expectedRevision: revisao, chaveLinha: chave.trim(), estado, justificativa: motivo.trim() }); }}>
      <fieldset disabled={!!pendente || envio.isPending}><label>Chave da linha <input maxLength={200} required value={chave} onChange={(e) => setChave(e.target.value)} /></label>{" "}
      <label>Situação <select value={estado} onChange={(e) => setEstado(e.target.value as "em_revisao" | "rejeitada")}><option value="em_revisao">Em revisão</option><option value="rejeitada">Rejeitada</option></select></label>{" "}
      <label>Motivo <textarea maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>{" "}
      <button type="submit">Registrar na revisão {revisao}</button></fieldset>
    </form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}
    {aviso && <p role="status">{aviso}</p>}
    <button type="button" disabled={!chave.trim()} onClick={() => setConsultada(chave.trim())}>Consultar histórico da linha</button>
    {historico.isError && <p role="alert">Não foi possível carregar histórico. <button type="button" onClick={() => void historico.refetch()}>Tentar novamente</button></p>}
    {historico.data && <ul>{historico.data.pages.flat().map((r) => <li key={r.id}>Revisão {r.revisao_lote}: {r.estado} · {r.justificativa} · {r.ator_id} · {r.criado_em}</li>)}</ul>}
    {historico.hasNextPage && <button type="button" disabled={historico.isFetching} onClick={() => void historico.fetchNextPage()}>Mais histórico</button>}
  </section>;
}
