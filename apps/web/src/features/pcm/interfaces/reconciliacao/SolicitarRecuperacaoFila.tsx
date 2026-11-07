import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
const revisao = z.string().regex(/^(0|[1-9][0-9]{0,18})$/);
const previaSchema = z.object({ outboxId: id, epoca: id, revisao,
  situacaoRemota: z.literal("desconhecida"), autorizaRetry: z.literal(false) }).strict();
const pedidoSchema = z.object({ atorId: id, clienteId: id, outboxId: id, requestId: id,
  epoca: id, revisao, motivo: z.string().trim().min(1).max(2000) }).strict();
const reciboSchema = z.object({ requestId: id, outboxId: id, epoca: id, revisao,
  solicitacaoRegistrada: z.literal(true), efeitoRemotoComprovado: z.literal(false), retryExecutado: z.literal(false) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; outboxId: string };

export function SolicitarRecuperacaoFila(props: Props) {
  if (import.meta.env.VITE_SSO_SOLICITAR_RECUPERACAO_FILA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.outboxId])} {...props} />;
}

function Conteudo({ userId, clienteId, outboxId }: Props) {
  const chave = `sso-solicitacao-recuperacao:${JSON.stringify([userId, clienteId, outboxId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      return pedido.atorId === userId && pedido.clienteId === clienteId && pedido.outboxId === outboxId ? pedido : "invalido";
    } catch { return "invalido"; }
  });
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const consulta = useQuery({
    queryKey: ["reconciliacao-previa-recuperacao", userId, clienteId, outboxId], retry: false, gcTime: 0, staleTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_previa_recuperacao_fila", {
        p_ator_id: userId, p_cliente_id: clienteId, p_outbox_id: outboxId,
      }).abortSignal(signal);
      if (error) throw error;
      const resultado = previaSchema.parse(data);
      if (resultado.outboxId !== outboxId) throw new Error("Item divergente.");
      await conferirSessao(signal); return resultado;
    },
  });
  const fotografia = consulta.data && !consulta.isFetching && !consulta.isError
    ? JSON.stringify([userId, clienteId, consulta.data, motivo.trim()]) : null;
  async function consultarRecibo(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      const serializado = JSON.stringify(pedido);
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_solicitacao_recuperacao", {
        p_ator_id: pedido.atorId, p_cliente_id: pedido.clienteId, p_outbox_id: pedido.outboxId,
        p_request_id: pedido.requestId, p_epoca: pedido.epoca, p_revisao: pedido.revisao, p_motivo: pedido.motivo,
      });
      if (error) throw error;
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada.");
      if (data === null) { setAviso("Recibo ausente. Isso não comprova falha; mantenha a tentativa."); return; }
      const r = reciboSchema.parse(data);
      if (r.requestId !== pedido.requestId || r.outboxId !== pedido.outboxId || r.epoca !== pedido.epoca || r.revisao !== pedido.revisao) throw new Error("Recibo divergente.");
      await cache.invalidateQueries({ queryKey: ["reconciliacao-solicitacoes", userId, clienteId, outboxId] });
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso("Solicitação local confirmada. Nenhum reenvio foi executado.");
    } catch { setAviso("Recibo indisponível. Preserve a tentativa ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      const serializado = JSON.stringify(pedido);
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_solicitar_recuperacao_fila", {
        p_ator_id: pedido.atorId, p_cliente_id: pedido.clienteId, p_outbox_id: pedido.outboxId,
        p_request_id: pedido.requestId, p_epoca: pedido.epoca, p_revisao: pedido.revisao, p_motivo: pedido.motivo,
      });
      if (error) throw error;
      const r = reciboSchema.parse(data);
      if (r.requestId !== pedido.requestId || r.outboxId !== pedido.outboxId || r.epoca !== pedido.epoca || r.revisao !== pedido.revisao) throw new Error("Recibo divergente.");
      await consulta.refetch();
      await cache.invalidateQueries({ queryKey: ["reconciliacao-solicitacoes", userId, clienteId, outboxId] });
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso("Solicitação registrada. Nenhum reenvio foi executado; o destino permanece desconhecido.");
    } catch { setAviso("Resultado não confirmado. Preserve a tentativa e repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!consulta.data || !fotografia || confirmacao !== fotografia || consulta.isFetching || consulta.isError || pendente || trava.current) return;
    try {
      const pedido = pedidoSchema.parse({ atorId: userId, clienteId, outboxId, requestId: crypto.randomUUID(),
        epoca: consulta.data.epoca, revisao: consulta.data.revisao, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Confira o motivo e o armazenamento; nada foi enviado."); }
  }
  return <section aria-label="Solicitar recuperação da integração">
    <h5>Solicitar recuperação</h5>
    <p>Solicitação local para análise pelo responsável. Não confirma efeito remoto e não executa reenvio.</p>
    {consulta.isFetching && <output>Consultando revisão…</output>}
    {consulta.isError && <p role="alert">Revisão indisponível. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {pendente === "invalido" ? <p role="alert">Tentativa ilegível. Procure suporte.</p> : pendente
      ? <><button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesma solicitação</button>
        {import.meta.env.VITE_SSO_RECIBO_SOLICITACAO_RECUPERACAO_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void consultarRecibo(pendente)}>Consultar recibo</button>}</>
      : <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
        {consulta.data && !consulta.isFetching && !consulta.isError && <p>Revisão local {consulta.data.revisao}.</p>}
        <label>Motivo <textarea value={motivo} maxLength={2000} required disabled={ocupado} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
        <label><input type="checkbox" disabled={!fotografia || ocupado} checked={Boolean(fotografia && confirmacao === fotografia)}
          onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi o item, revisão e motivo.</label>
        <button type="submit" disabled={!fotografia || confirmacao !== fotografia || ocupado}>Registrar solicitação</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
