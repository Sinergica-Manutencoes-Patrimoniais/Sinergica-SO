import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedido = z.object({ requestId: z.string().uuid(), outboxId: z.string().uuid(), componenteId: z.string().uuid(), observacao: z.string().trim().min(1).max(2000) }).strict();
type Tentativa = { chave: string; texto: string; pedido: z.infer<typeof pedido> };
export function RecuperarObservacoesReserva({ userId, clienteId }: { userId: string; clienteId: string }) {
  return <Conteudo key={JSON.stringify([userId, clienteId])} userId={userId} clienteId={clienteId} />;
}
function Conteudo({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [mensagem, setMensagem] = useState(""); const [, atualizar] = useState(0); const trava = useRef(false);
  const tentativas: Tentativa[] = []; let invalida = false;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i); if (!chave?.startsWith("sso-observacao-reserva:")) continue;
      let contexto: unknown; try { contexto = JSON.parse(chave.slice("sso-observacao-reserva:".length)); } catch { continue; }
      if (!Array.isArray(contexto) || contexto[0] !== userId || contexto[1] !== clienteId) continue;
      try { const texto = sessionStorage.getItem(chave); if (!texto || texto.length > 10000) throw new Error(); const p = pedido.parse(JSON.parse(texto));
        if (contexto.length !== 4 || contexto[2] !== p.outboxId || contexto[3] !== p.componenteId) throw new Error(); tentativas.push({ chave, texto, pedido: p });
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  const consulta = useMutation({ mutationFn: async (t: Tentativa) => {
    if (sessionStorage.getItem(t.chave) !== t.texto) throw new Error("Tentativa alterada.");
    const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
    const p = t.pedido; const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_recibo_observacao_reserva", {
      p_ator_id: userId, p_cliente_id: clienteId, p_request_id: p.requestId, p_outbox_id: p.outboxId, p_componente_id: p.componenteId, p_observacao: p.observacao,
    });
    if (error) throw error;
    const recibo = z.object({ requestId: z.string().uuid(), outboxId: z.string().uuid(), componenteId: z.string().uuid(), criadoEm: z.string().datetime({ offset: true }) }).strict().parse(data);
    if (recibo.requestId !== p.requestId || recibo.outboxId !== p.outboxId || recibo.componenteId !== p.componenteId) throw new Error("Recibo divergente.");
    const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
    return recibo;
  }, onSuccess: async (_recibo, t) => {
    try { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(t.chave) !== t.texto) throw new Error();
      sessionStorage.removeItem(t.chave); atualizar((n) => n + 1); setMensagem("Observação confirmada no histórico local. Isso não confirma o envio ao Auvo.");
    } catch { setMensagem("Recibo encontrado, mas a tentativa não foi removida. Confira a sessão."); }
  }, onError: () => setMensagem("Não foi possível confirmar o recibo. A tentativa foi preservada; consulte suporte."), onSettled: () => { trava.current = false; } });
  if (!tentativas.length && !invalida && !mensagem) return null;
  return <section aria-label="Recuperação de observações"><h3>Recuperar observações pendentes</h3>
    <p>A consulta verifica somente o registro local; não reenvia ao Auvo nem libera reserva.</p>
    {invalida && <p role="alert">Há tentativa local ilegível. Consulte suporte.</p>}
    <ul>{tentativas.map((t) => <li key={t.chave}>Fila {t.pedido.outboxId} · Componente {t.pedido.componenteId}
      <button type="button" disabled={consulta.isPending} onClick={() => { if (trava.current) return; trava.current = true; consulta.mutate(t); }}>Consultar recibo</button></li>)}</ul>
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
