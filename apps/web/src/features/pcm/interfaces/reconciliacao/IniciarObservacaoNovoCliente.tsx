import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const pedidoSchema = z.object({ requestId: uuid, atorId: uuid, clienteId: uuid, osId: uuid,
  conflitoRevision: z.number().int().positive(), observacaoRevision: z.number().int().positive(), motivo: z.string().trim().min(1).max(1000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function IniciarObservacaoNovoCliente({ userId, clienteId, osId, conflitoRevision, observacaoRevision }: {
  userId: string; clienteId: string; osId: string; conflitoRevision: number; observacaoRevision: number | null;
}) {
  const chave = `sso-observacao-novo-cliente:${JSON.stringify([userId, clienteId, osId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw));
      return p.atorId === userId && p.clienteId === clienteId && p.osId === osId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState(""); const trava = useRef(false); const cache = useQueryClient();
  const fotografia = JSON.stringify({ userId, clienteId, osId, conflitoRevision, observacaoRevision, motivo: motivo.trim() });
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_iniciar_observacao_cliente_mediada", {
        p_request_id: p.requestId, p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_os_id: p.osId,
        p_conflito_revisao: p.conflitoRevision, p_observacao_revisao: p.observacaoRevision, p_motivo: p.motivo,
      }); if (error) throw error;
      const r = z.object({ requestId: uuid, osId: uuid, clienteId: uuid, conflitoRevision: z.number().int().positive(),
        observacaoRevision: z.number().int().positive(), estado: z.enum(["incerto", "vinculo_observado_nao_confirmado"]),
        historicoTransferido: z.literal(false), efeitoRemotoComprovado: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.osId !== p.osId || r.clienteId !== p.clienteId || r.conflitoRevision !== p.conflitoRevision ||
        r.observacaoRevision !== p.observacaoRevision + 1) throw new Error("Recibo divergente");
      await conferirAtor(); await cache.invalidateQueries({ queryKey: ["reconciliacao-conflitos-propriedade-os", userId, clienteId] });
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setMotivo(""); setConfirmacao(null);
      setAviso("Observação iniciada. Histórico anterior preservado; estado remoto não confirmado.");
    } catch { setAviso("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || observacaoRevision === null || confirmacao !== fotografia) return;
    try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, osId, conflitoRevision, observacaoRevision, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente"); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Não foi possível guardar a tentativa. Nada foi enviado."); }
  }
  return <section aria-label="Iniciar observação no Cliente atual">
    <p>Requer acesso aos dois Clientes. Não transfere histórico nem confirma o estado no Auvo.</p>
    {pendente === "invalido" ? <p role="alert">Tentativa inválida. Procure suporte.</p> : pendente ? <>
      <p>Há tentativa pendente; o resultado pode ser incerto.</p><button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</button>
    </> : observacaoRevision !== null ? <>
      <label>Motivo <textarea maxLength={1000} value={motivo} disabled={ocupado} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === fotografia} disabled={ocupado || !motivo.trim()} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi a OS e a revisão do conflito.</label>
      <button type="button" disabled={ocupado || !motivo.trim() || confirmacao !== fotografia} onClick={iniciar}>Iniciar observação neste Cliente</button>
    </> : <p>Não há decisão disponível nesta consulta.</p>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
