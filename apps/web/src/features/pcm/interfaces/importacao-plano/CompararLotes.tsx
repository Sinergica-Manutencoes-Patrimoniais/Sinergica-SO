import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { ConferenciaIntegrada } from "./ConferenciaIntegrada";
import { compararIdentidadesCronograma, identificarLinhaCronograma, obterCronogramaStaging, type PedidoIdentidadeCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";

export function CompararLotes({ userId, clienteId, lotes }: { userId: string; clienteId: string; lotes: { id: string; fonte: string; revisao: number }[] }) {
  const [anterior, setAnterior] = useState(""); const [novo, setNovo] = useState("");
  const [lote, setLote] = useState(""); const [linha, setLinha] = useState(""); const [identidade, setIdentidade] = useState(""); const [mensagem, setMensagem] = useState("");
  const cache = useQueryClient(); const storageKey = `sso-identidade-cronograma:${JSON.stringify([userId, clienteId])}`;
  const trava = useRef(false);
  async function conferirSessao() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada."); }
  const [pendente, setPendente] = useState<PedidoIdentidadeCronograma | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as PedidoIdentidadeCronograma;
      return typeof p.requestId === "string" && typeof p.loteId === "string" && Number.isSafeInteger(p.expectedRevision) && typeof p.chaveLinha === "string" && typeof p.identidade === "string" ? p : "invalido";
    } catch { return "invalido"; }
  });
  const detalhe = useQuery({ queryKey: ["identidade-cronograma", userId, clienteId, lote], enabled: !!lote, gcTime: 0,
    queryFn: ({ signal }) => obterCronogramaStaging(clienteId, lote, signal) });
  const comparacao = useInfiniteQuery({ queryKey: ["comparacao-identidades", userId, clienteId, anterior, novo],
    enabled: !!anterior && !!novo && anterior !== novo, gcTime: 0, initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => compararIdentidadesCronograma(clienteId, anterior, novo, pageParam, signal),
    getNextPageParam: (page) => page.length === 20 ? page.at(-1)?.identidade : undefined });
  const envio = useMutation({ mutationFn: async (pedido: PedidoIdentidadeCronograma) => {
    await conferirSessao();
    if (sessionStorage.getItem(storageKey) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
    const resultado = await identificarLinhaCronograma(pedido);
    await conferirSessao();
    return resultado;
  }, onSuccess: async (_resultado, pedido) => {
    try {
      await Promise.all([cache.invalidateQueries({ queryKey: ["conferencia-integrada-cronograma", userId, clienteId, pedido.loteId] }), cache.invalidateQueries({ queryKey: ["diagnostico-cronograma", userId, clienteId, pedido.loteId] }), cache.invalidateQueries({ queryKey: ["identidade-cronograma", userId, clienteId] }), cache.invalidateQueries({ queryKey: ["comparacao-identidades", userId, clienteId] }), cache.invalidateQueries({ queryKey: ["importacao-plano", userId, clienteId, "lotes"] })]);
      await conferirSessao();
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(pedido)) throw new Error("Tentativa divergente.");
      sessionStorage.removeItem(storageKey);
    } catch { setMensagem("Identidade guardada, mas não foi possível limpar a tentativa local; procure suporte."); return; }
    setPendente(null); setMensagem("Identidade declarada em staging; não representa aprovação nem incorporação.");
  }, onError: () => setMensagem("Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; em caso de conflito, procure suporte."), onSettled: () => { trava.current = false; } });
  const enviar = (p: PedidoIdentidadeCronograma, repeticao = false) => {
    if (trava.current) return;
    trava.current = true;
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (repeticao ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error("Tentativa divergente.");
      if (!repeticao) sessionStorage.setItem(storageKey, JSON.stringify(p));
    } catch { trava.current = false; setMensagem("Não foi possível guardar a tentativa; nada foi enviado."); return; }
    setPendente(p); envio.mutate(p);
  };
  const opcoes = lotes.map((l) => <option key={l.id} value={l.id}>{l.fonte} · revisão {l.revisao}</option>);
  return <section aria-label="Identidades e comparação de cronograma"><h3>Identificar e comparar linhas</h3>
    <p>Declare a mesma identidade somente após conferência humana. A comparação considera apenas linhas identificadas; não identifica rejeições, não aprova nem cria Rotinas. Linhas sem identidade ficam fora do resultado.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || !detalhe.data || detalhe.isFetching || detalhe.isError || !linha.trim() || !identidade.trim()) return;
      enviar({ requestId: crypto.randomUUID(), loteId: lote, expectedRevision: detalhe.data.revision, chaveLinha: linha.trim(), identidade: identidade.trim() }); }}>
      <fieldset disabled={!!pendente || envio.isPending}><label>Lote <select required value={lote} onChange={(e) => { setLote(e.target.value); setLinha(""); }}><option value="">Selecione</option>{opcoes}</select></label>{" "}
        <label>Chave da linha de origem <input required maxLength={200} value={linha} onChange={(e) => setLinha(e.target.value)} /></label>{" "}
        <label>Identidade declarada <input required maxLength={200} value={identidade} onChange={(e) => setIdentidade(e.target.value)} /></label>{" "}
        <button type="submit" disabled={!detalhe.data || detalhe.isFetching || detalhe.isError}>Guardar identidade</button>
      </fieldset>
    </form>
    {detalhe.data && !detalhe.isFetching && <p>Revisão consultada: {detalhe.data.revision}. Consulte os valores na conferência do lote antes de declarar a identidade.</p>}
    {lote && !pendente && import.meta.env.VITE_SSO_CONFERENCIA_INTEGRADA_CRONOGRAMA_ENABLED === "true" && <ConferenciaIntegrada key={lote} userId={userId} clienteId={clienteId} loteId={lote} onSelecionar={setLinha} />}
    {detalhe.isError && <p role="alert">Não foi possível consultar o lote.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" && <p>Tentativa pendente. <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>Repetir a mesma tentativa</button></p>}
    {mensagem && <p role="status">{mensagem}</p>}
    <label>Lote anterior <select value={anterior} onChange={(e) => setAnterior(e.target.value)}><option value="">Selecione</option>{opcoes}</select></label>{" "}
    <label>Lote novo <select value={novo} onChange={(e) => setNovo(e.target.value)}><option value="">Selecione</option>{opcoes}</select></label>
    {anterior && novo && anterior === novo && <p>Selecione dois lotes distintos.</p>}
    {comparacao.isFetching && <p>Consultando identidades…</p>}
    {comparacao.isError && <p role="alert">Não foi possível comparar. <button type="button" onClick={() => void comparacao.refetch()}>Tentar novamente</button></p>}
    {comparacao.data && !comparacao.isError && <ul>{comparacao.data.pages.flat().map((x) => <li key={x.identidade}>{x.identidade}: {x.estado} · linha anterior {x.chave_anterior ?? "não identificada"} · linha nova {x.chave_nova ?? "não identificada"}</li>)}</ul>}
    {comparacao.hasNextPage && <button type="button" disabled={comparacao.isFetching} onClick={() => void comparacao.fetchNextPage()}>Mais identidades</button>}
  </section>;
}
