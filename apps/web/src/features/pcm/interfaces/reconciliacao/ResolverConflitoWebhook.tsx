import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z.object({ requestId: z.string().uuid(), usuario: z.string(), cliente: z.string(), os: z.string(),
  conflito: z.string(), taskId: z.string().regex(/^\d+$/), status: z.string(), atualizadoEm: z.string() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { usuario: string; cliente: string; os: string; conflito: string; statusRemoto: string; statusAtual: string; taskId: string; taskAtual: string | null; atualizadoEm: string };

export function ResolverConflitoWebhook(props: Props) {
  const chave = `sso-resolucao-webhook:${JSON.stringify([props.usuario, props.cliente, props.os, props.conflito])}`;
  const [atestado, setAtestado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const parsed = pedidoSchema.safeParse(JSON.parse(salvo));
      return parsed.success && parsed.data.usuario === props.usuario && parsed.data.cliente === props.cliente && parsed.data.os === props.os && parsed.data.conflito === props.conflito ? parsed.data : "invalido";
    } catch { return "invalido"; }
  });
  const cache = useQueryClient();
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_resolver_conflito_webhook_chamado", {
        p_request_id: p.requestId, p_cliente_id: p.cliente, p_conflito_id: p.conflito,
        p_os_updated_at: p.atualizadoEm, p_task_id: p.taskId, p_status_atual: p.status, p_conferiu_remoto: true,
      });
      if (error) throw error;
      if (!data || data.requestId !== p.requestId || data.conflitoId !== p.conflito || data.conferenciaRemotaAtestada !== true) throw new Error("Resposta inválida.");
    },
    onSuccess: async (_resultado, enviada) => {
      await cache.invalidateQueries({ queryKey: ["reconciliacao-webhook-conflitos", props.usuario, props.cliente, props.os] });
      await cache.invalidateQueries({ queryKey: ["reconciliacao-os", props.usuario, props.cliente] });
      try {
        if (sessionStorage.getItem(chave) !== JSON.stringify(enviada)) { setMensagem("Decisão registrada, mas a tentativa local mudou. Reabra para conferir."); return; }
        sessionStorage.removeItem(chave);
      } catch { setMensagem("Decisão registrada, mas a tentativa local não pôde ser limpa. Procure suporte."); return; }
      setPedido(null); setAtestado(false); setMensagem("Resolução registrada. Nenhuma ação no Auvo foi realizada.");
    },
    onError: () => setMensagem("Resultado não confirmado. Repita a mesma decisão ou procure suporte."),
  });
  const coerente = props.statusAtual === props.statusRemoto && props.taskAtual === props.taskId;
  function registrar() {
    if (pedido || !atestado || !coerente || envio.isPending) return;
    try {
      if (sessionStorage.getItem(chave) !== null) { setMensagem("Há tentativa anterior. Reabra para recuperá-la."); return; }
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), usuario: props.usuario, cliente: props.cliente, os: props.os,
        conflito: props.conflito, taskId: props.taskId, status: props.statusAtual, atualizadoEm: props.atualizadoEm });
      sessionStorage.setItem(chave, JSON.stringify(p)); setPedido(p); envio.mutate(p);
    } catch { setMensagem("Não foi possível guardar a decisão; nada foi enviado."); }
  }
  function repetir(p: Pedido) {
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) { setMensagem("Tentativa local alterada. Reabra para conferir."); return; }
      envio.mutate(p);
    } catch { setMensagem("Não foi possível conferir a tentativa. Nada foi enviado."); }
  }
  return <div>
    {!coerente && !pedido && <p>Status ainda divergente ou task alterada; revise a OS antes de decidir.</p>}
    {coerente && !pedido && <>
      <label><input type="checkbox" checked={atestado} onChange={(e) => setAtestado(e.target.checked)} /> Atesto que conferi o estado atual no Auvo.</label>
      <button type="button" disabled={!atestado || envio.isPending} onClick={registrar}>Registrar resolução</button>
    </>}
    {pedido === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
    {pedido && pedido !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => repetir(pedido)}>Repetir mesma decisão</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </div>;
}
