import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { HistoricoReversaoLote } from "./HistoricoReversaoLote";

const id = z.string().guid();
const loteSchema = z.object({ lote_id: id, quantidade: z.number().int().min(1).max(20), criado_em: z.string().datetime({ offset: true }) }).strict();
const origemSchema = z.object({ clienteId: id, planoId: id, origemRequestId: id, revisao: z.number().int().positive(),
  estado: z.string(), versaoId: id, rotinaId: id }).strict();
const detalheSchema = z.object({ clienteId: id, loteId: id, itens: z.array(origemSchema).min(1).max(20), dependenciasComprovadas: z.literal(false) }).strict();
const itemSchema = z.object({ requestId: id, origemRequestId: id, planoId: id, revisao: z.number().int().positive() }).strict();
const pedidoSchema = z.object({ atorId: id, clienteId: id, requestId: id, loteId: id, motivo: z.string().trim().min(1).max(2000), itens: z.array(itemSchema).min(1).max(20) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string };

export function ReversaoLotesLegados(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Conteudo({ userId, clienteId }: Props) {
  const chave = `sso-reversao-lote-legado:${JSON.stringify([userId, clienteId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(chave); if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw)); return p.atorId === userId && p.clienteId === clienteId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [loteId, setLoteId] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const trava = useRef(false); const cache = useQueryClient();
  async function conferirSessao(signal?: AbortSignal) { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const lotes = useInfiniteQuery({ queryKey: ["migracao-lotes-reversao", userId, clienteId], gcTime: 0, retry: false, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_lotes_rascunhos_legados", { p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(loteSchema).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? "";
      for (const l of pagina) { if (l.lote_id.toLowerCase() <= anterior) throw new Error("Página divergente."); anterior = l.lote_id.toLowerCase(); }
      await conferirSessao(signal); return pagina;
    }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.lote_id : undefined });
  const detalhe = useQuery({ queryKey: ["migracao-lote-reversao", userId, clienteId, loteId], enabled: !!loteId && !pendente, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_reversao_lote_legado", { p_ator_id: userId, p_cliente_id: clienteId, p_lote_id: loteId }).abortSignal(signal);
      if (error) throw error; const r = detalheSchema.parse(data);
      if (r.clienteId !== clienteId || r.loteId !== loteId || r.itens.some((i) => i.clienteId !== clienteId) ||
        new Set(r.itens.map((i) => i.origemRequestId)).size !== r.itens.length || new Set(r.itens.map((i) => i.planoId)).size !== r.itens.length) throw new Error("Detalhe divergente.");
      await conferirSessao(signal); return r;
    } });
  const fotografia = JSON.stringify([userId, clienteId, detalhe.data ?? null, motivo.trim()]);
  async function enviar(p: Pedido, somenteRecibo = false) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso("");
    try {
      await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      const { data, error } = somenteRecibo
        ? await supabase.schema("pcm").rpc("sso_recibo_reversao_lote_legado", { p_ator_id: userId, p_cliente_id: clienteId, p_request_id: p.requestId, p_lote_id: p.loteId })
        : await supabase.schema("pcm").rpc("sso_avaliar_reversao_lote_legado", {
          p_ator_id: userId, p_cliente_id: clienteId, p_request_id: p.requestId, p_lote_request_id: p.loteId,
          p_itens: p.itens.map(({ requestId, origemRequestId, revisao }) => ({ requestId, origemRequestId, revisao })), p_motivo: p.motivo,
        });
      if (error || !data || data.requestId !== p.requestId || data.clienteId !== clienteId || data.loteRequestId !== p.loteId || data.historicoApagado !== false ||
        !Number.isSafeInteger(data.revertidos) || !Number.isSafeInteger(data.pendentes) || data.revertidos < 0 || data.pendentes < 0 ||
        data.revertidos + data.pendentes !== p.itens.length || !Array.isArray(data.itens) || data.itens.length !== p.itens.length) throw new Error("Recibo inválido.");
      const resultados = new Map<string, Record<string, unknown>>();
      for (const r of data.itens) { if (!r || typeof r !== "object" || typeof r.requestId !== "string" || resultados.has(r.requestId)) throw new Error("Recibo inválido."); resultados.set(r.requestId, r); }
      let revertidos = 0; let aguardando = 0;
      for (const i of p.itens) { const r = resultados.get(i.requestId); const links = r?.linkedIds as Record<string, unknown> | undefined;
        if (!r || r.aggregateId !== i.planoId || links?.clienteId !== clienteId || links?.origemRequestId !== i.origemRequestId ||
          !((r.state === "revertido_logicamente" && r.revision === i.revisao + 1) || (r.state === "pendente_reconciliacao" && r.revision === i.revisao))) throw new Error("Recibo divergente.");
        if (r.state === "revertido_logicamente") revertidos++; else aguardando++;
      }
      if (revertidos !== data.revertidos || aguardando !== data.pendentes) throw new Error("Contagem divergente.");
      await cache.invalidateQueries({ queryKey: ["migracao-lote-reversao", userId, clienteId, p.loteId], refetchType: "none" });
      await cache.invalidateQueries({ queryKey: ["migracao-historico-reversao-lote", userId, clienteId, p.loteId], refetchType: "none" });
      await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso(`Avaliação registrada: ${revertidos} rascunho(s) encerrado(s) logicamente e ${aguardando} pendente(s) de reconciliação. Nenhum histórico foi apagado.`);
      void cache.refetchQueries({ queryKey: ["migracao-lote-reversao", userId, clienteId, p.loteId], type: "active" });
      void cache.refetchQueries({ queryKey: ["migracao-historico-reversao-lote", userId, clienteId, p.loteId], type: "active" });
    } catch { setAviso(somenteRecibo ? "Recibo indisponível ou divergente. A tentativa pode estar em andamento; procure suporte." : "Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (pendente || ocupado || !detalhe.data || detalhe.isFetching || detalhe.isError || confirmacao !== fotografia) return;
    try {
      const p = pedidoSchema.parse({ atorId: userId, clienteId, requestId: crypto.randomUUID(), loteId, motivo,
        itens: detalhe.data.itens.map((i) => ({ requestId: crypto.randomUUID(), origemRequestId: i.origemRequestId, planoId: i.planoId, revisao: i.revisao })) });
      if (sessionStorage.getItem(chave) !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira o motivo e a tentativa. Nada foi enviado."); }
  }
  return <section aria-label="Avaliar reversão de lote legado"><h4>Avaliar reversão de lote</h4>
    <p>Nenhum histórico será apagado. Sem cobertura de dependências, os Planos permanecem pendentes de reconciliação.</p>
    {pendente === "invalido" ? <p role="alert">Tentativa ilegível. Procure suporte.</p> : pendente ? <>
      <p>Tentativa pendente para lote {pendente.loteId}, {pendente.itens.length} Plano(s).</p><button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button>
      {import.meta.env.VITE_SSO_RECIBOS_LOTES_LEGADOS_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void enviar(pendente, true)}>Consultar recibo sem repetir</button>}
    </> : <>
      {lotes.isFetching && <p>Consultando lotes…</p>}{lotes.isError && <p role="alert">Lotes indisponíveis. <button type="button" onClick={() => void lotes.refetch()}>Tentar novamente</button></p>}
      <label>Lote <select value={loteId} disabled={lotes.isFetching || lotes.isError} onChange={(e) => { setLoteId(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>
        {lotes.data?.pages.flat().map((l) => <option key={l.lote_id} value={l.lote_id}>{l.lote_id} · {l.quantidade} Plano(s)</option>)}</select></label>
      {lotes.hasNextPage && <button type="button" disabled={lotes.isFetching} onClick={() => void lotes.fetchNextPage()}>Mais lotes</button>}
      {loteId && <HistoricoReversaoLote userId={userId} clienteId={clienteId} loteId={loteId} />}
      {detalhe.isFetching && <p>Consultando revisões…</p>}{detalhe.isError && <p role="alert">Detalhe indisponível. <button type="button" onClick={() => void detalhe.refetch()}>Tentar novamente</button></p>}
      {!detalhe.isFetching && !detalhe.isError && detalhe.data && <><ul>{detalhe.data.itens.map((i) => <li key={i.planoId}>Plano {i.planoId} · {i.estado} · revisão {i.revisao}</li>)}</ul>
        <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
        <label><input type="checkbox" checked={confirmacao === fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi os Planos, revisões e motivo.</label>
        <button type="button" disabled={ocupado || !motivo.trim() || confirmacao !== fotografia} onClick={iniciar}>Solicitar avaliação do lote</button></>}
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
