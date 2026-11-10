import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const tarefa = z.string().regex(/^[1-9][0-9]{0,15}$/).refine(v => Number.isSafeInteger(Number(v)) && Number(v) > 0);
const pedidoSchema = z.object({ requestId: uuid, clienteId: uuid, osId: uuid, reservaId: uuid, tarefa, motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function ReconciliarReservaLegada({ userId, clienteId, reserva }: { userId: string; clienteId: string; reserva: { reservaId: string; osId: string } | null }) {
  if (import.meta.env.VITE_SSO_RECONCILIAR_RESERVA_LEGADA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([userId, clienteId])} userId={userId} clienteId={clienteId} reserva={reserva} />;
}
function Conteudo({ userId, clienteId, reserva }: { userId: string; clienteId: string; reserva: { reservaId: string; osId: string } | null }) {
  const chave = `sso-reconciliar-reserva-legada:${JSON.stringify([userId, clienteId])}`;
  const cache = useQueryClient(); const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false); const [numero, setNumero] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.clienteId === clienteId ? p : "invalido"; }
    catch { return "invalido"; }
  });
  const foto = JSON.stringify([userId, clienteId, reserva, numero, motivo.trim()]);
  async function sessao() { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId) throw new Error("Sessão alterada."); }
  async function enviar(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso("");
    try {
      await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_reconciliar_reserva_com_vinculo", { p_request_id: p.requestId,
        p_cliente_id: p.clienteId, p_os_id: p.osId, p_reserva_id: p.reservaId, p_tarefa: p.tarefa, p_motivo: p.motivo });
      if (error) throw error;
      const r = z.object({ requestId: uuid, clienteId: uuid, osId: uuid, reservaId: uuid, tarefa, estado: z.literal("confirmado"),
        efeitoRemotoComprovado: z.literal(false), tarefaAuvoCriada: z.literal(false) }).strict().parse(data);
      if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.osId !== p.osId || r.reservaId !== p.reservaId || r.tarefa !== p.tarefa) throw new Error("Resposta divergente.");
      await sessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setNumero(""); setMotivo("");
      setAviso("Reserva confirmada pelo vínculo local; estado remoto não foi consultado.");
      await cache.invalidateQueries({ queryKey: ["reservas-envio-legado", userId, clienteId] });
    } catch { setAviso("Resultado não confirmado. Preserve a tentativa e repita o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!reserva || pendente || ocupado || confirmacao !== foto) return;
    try {
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, osId: reserva.osId, reservaId: reserva.reservaId, tarefa: numero, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira tarefa e motivo. Nenhum pedido foi enviado."); }
  }
  return <section aria-label="Reconciliar reserva com vínculo local"><h5>Confirmar reserva pelo vínculo local</h5>
    <p>Somente se a mesma tarefa já estiver vinculada à OS no SSO. Não consulta ou cria tarefa Auvo, nem comprova o estado remoto.</p>
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
    {pendente && pendente !== "invalido" ? <><p>Tentativa preservada: OS {pendente.osId}, reserva {pendente.reservaId}, tarefa {pendente.tarefa}.</p>
      <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button></> : !pendente && reserva && <>
      <p>OS {reserva.osId} · reserva {reserva.reservaId}</p>
      <label>ID da tarefa vinculada <input inputMode="numeric" value={numero} onChange={(e) => { setNumero(e.target.value); setConfirmacao(null); }} /></label>
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmacao === foto} disabled={ocupado} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Conferi OS, reserva e vínculo local.</label>
      <button type="button" disabled={ocupado || confirmacao !== foto || !tarefa.safeParse(numero).success || !motivo.trim()} onClick={iniciar}>Confirmar reserva</button>
    </>}
    {!pendente && !reserva && <p>Selecione uma reserva na lista.</p>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
