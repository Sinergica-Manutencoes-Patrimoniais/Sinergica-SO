import { useRef, useState } from "react";
import { z } from "zod";
import type { PedidoReconciliacaoCronograma } from "../../infrastructure/supabase-reconciliacao-cronograma";

type Lote = { id: string; fonte: string; revisao: number; criadoEm: string; reconciliado: boolean };
type Props = { userId: string; clienteId: string; lote: Lote; enviar: (pedido: PedidoReconciliacaoCronograma) => Promise<void> };
const pedidoSchema = z.object({ atorId: z.string().guid(), requestId: z.string().guid(), clienteId: z.string().min(1), loteId: z.string().guid(), revisao: z.number().int().positive().safe(), motivo: z.string().trim().min(1).max(2000) }).strict();

/** Preparado para composição futura; não consulta nem habilita gates por si só. */
export function ReconciliarLegado(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.lote.id])} {...props} />;
}
function Conteudo({ userId, clienteId, lote, enviar }: Props) {
  const chave = `sso-reconciliar-cronograma:${JSON.stringify([userId, clienteId, lote.id])}`;
  const [motivo, setMotivo] = useState("");
  const [revisaoConferida, setRevisaoConferida] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const trava = useRef(false);
  const [pedido, setPedido] = useState<PedidoReconciliacaoCronograma | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const p = pedidoSchema.parse(JSON.parse(salvo));
      return p.atorId === userId && p.clienteId === clienteId && p.loteId === lote.id ? p : "invalido";
    } catch { return "invalido"; }
  });
  async function executar(p: PedidoReconciliacaoCronograma, repeticao: boolean) {
    if (trava.current) return;
    trava.current = true;
    try {
      const salva = sessionStorage.getItem(chave);
      if (repeticao ? salva !== JSON.stringify(p) : salva !== null) throw new Error("tentativa divergente");
      if (!repeticao) sessionStorage.setItem(chave, JSON.stringify(p));
    } catch { trava.current = false; setMensagem("Tentativa local indisponível ou alterada; nada foi enviado. Procure suporte."); return; }
    setPedido(p); setOcupado(true); setMensagem("");
    try {
      await enviar(p);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) { setMensagem("Reconciliação registrada, mas a tentativa local mudou. Procure suporte."); return; }
      sessionStorage.removeItem(chave);
      setPedido(null); setRevisaoConferida(null); setMotivo(""); setConcluido(true);
      setMensagem("Reconciliação registrada. O lote permanece pendente de conferência.");
    } catch { setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (pedido || ocupado || concluido || lote.reconciliado || revisaoConferida !== lote.revisao || !motivo.trim() || motivo.trim().length > 2000) return;
    const p = pedidoSchema.parse({ atorId: userId, requestId: crypto.randomUUID(), clienteId, loteId: lote.id, revisao: lote.revisao, motivo: motivo.trim() });
    void executar(p, false);
  }
  return <section aria-label={`Reconciliação de ${lote.fonte}`}>
    <p>{lote.fonte} · revisão {lote.revisao}. A listagem não garante que o lote seja compatível; o servidor fará a conferência.</p>
    {lote.reconciliado && !pedido && <p>Este lote já foi reconciliado.</p>}
    {!pedido && !lote.reconciliado && !concluido && <>
      <label>Motivo da reconciliação <input value={motivo} maxLength={2000} disabled={ocupado} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label><input type="checkbox" checked={revisaoConferida === lote.revisao} disabled={ocupado} onChange={(e) => setRevisaoConferida(e.target.checked ? lote.revisao : null)} /> Conferi o lote e a revisão</label>
      <button type="button" disabled={ocupado || revisaoConferida !== lote.revisao || !motivo.trim()} onClick={iniciar}>Solicitar reconciliação</button>
    </>}
    {pedido === "invalido" && <p role="alert">Tentativa local ilegível. Procure suporte.</p>}
    {pedido && pedido !== "invalido" && <button type="button" disabled={ocupado} onClick={() => void executar(pedido, true)}>Repetir mesma tentativa</button>}
    {ocupado && <output>Registrando reconciliação…</output>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
