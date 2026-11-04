import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const pedidoSchema = z.object({ requestId: uuid, atorId: uuid, clienteId: uuid, outboxId: uuid,
  revisao: z.number().int().positive(), motivo: z.string().trim().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function ConfirmarRetornoPropriedadeFila({ userId, clienteId, outboxId, revisao, disponivel, permitido }: {
  userId: string; clienteId: string; outboxId: string; revisao: number; disponivel: boolean; permitido: boolean;
}) {
  const chave = `sso-confirmar-retorno-fila:${JSON.stringify([userId, clienteId, outboxId])}`;
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === userId && p.clienteId === clienteId && p.outboxId === outboxId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const trava = useRef(false); const cache = useQueryClient();
  const fotografia = JSON.stringify({ userId, clienteId, outboxId, revisao, motivo: motivo.trim() });
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  async function enviar(p: Pedido) {
    if (trava.current || !disponivel) return;
    trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_confirmar_retorno_propriedade_fila", {
        p_request_id: p.requestId, p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_outbox_id: p.outboxId, p_revisao: p.revisao, p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z.object({ requestId: uuid, outboxId: uuid, clienteId: uuid, revisao: z.number().int().positive(),
        historicoTransferido: z.literal(false), efeitoRemotoComprovado: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.outboxId !== p.outboxId || r.clienteId !== p.clienteId || r.revisao !== p.revisao) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: ["reconciliacao-conflitos-fila", userId, clienteId] });
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPedido(null); setConfirmacao(null); setMotivo(""); setAviso("Conferência registrada. Nenhum histórico foi transferido.");
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pedido || !disponivel || !permitido || confirmacao !== fotografia || !motivo.trim()) return;
    try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, outboxId, revisao, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPedido(p); void enviar(p);
    } catch { setAviso("Não foi possível guardar a tentativa. Nada foi enviado."); }
  }
  return <section aria-label="Confirmar retorno da propriedade da fila">
    <p>Registra a conferência do retorno; não transfere histórico nem confirma ou altera o Auvo.</p>
    {pedido === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pedido ? <>
      <p>Há uma tentativa pendente; o resultado pode ser incerto.</p><button type="button" disabled={ocupado || !disponivel} onClick={() => void enviar(pedido)}>Repetir mesmo pedido</button>
    </> : permitido ? <>
      <label>Motivo <textarea maxLength={1000} value={motivo} disabled={ocupado} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === fotografia} disabled={ocupado || !motivo.trim()} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi o retorno e a revisão {revisao}.</label>
      <button type="button" disabled={ocupado || !disponivel || !motivo.trim() || confirmacao !== fotografia} onClick={iniciar}>Confirmar retorno</button>
    </> : <p>Não há nova confirmação disponível para esta situação.</p>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
