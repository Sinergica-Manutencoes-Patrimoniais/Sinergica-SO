import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const pedido = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, revisao: z.number().int().positive(), tipoTarefaId: uuid }).strict();
type Pedido = z.infer<typeof pedido>;
export function RegistrarTarefaLegada({ userId, clienteId, planoId, revisao, tipoTarefaId, disponivel }: { userId: string; clienteId: string; planoId: string; revisao: number; tipoTarefaId: string; disponivel: boolean }) {
  const chave = `sso-tarefa-plano-legado:${JSON.stringify([userId, clienteId, planoId])}`; const cache = useQueryClient(); const trava = useRef(false);
  const [confirmado, setConfirmado] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedido.parse(JSON.parse(raw)); return p.clienteId === clienteId && p.planoId === planoId ? p : "invalido"; } catch { return "invalido"; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => { const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_registrar_referencia_tarefa_legada", { p_ator_id: userId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_plano_legado_id: p.planoId, p_expected_revision: p.revisao, p_tipo_tarefa_id: p.tipoTarefaId }); if (error) throw error;
    const r = z.object({ requestId: uuid, planoId: uuid, rotinaId: uuid, versaoId: uuid, tipoTarefaId: uuid, osAlterada: z.literal(false), envioAuvo: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.planoId !== p.planoId || r.tipoTarefaId !== p.tipoTarefaId) throw new Error("Recibo divergente."); const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada."); return r;
  }, onSuccess: async (_, p) => { try { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada."); sessionStorage.removeItem(chave); setPendente(null); setConfirmado(null); setAviso("Referência de origem preservada; nenhuma OS foi alterada."); await cache.invalidateQueries({ queryKey: ["migracao-conferencia-plano", userId, clienteId, planoId] }); } catch { setAviso("Referência confirmada, mas a tentativa local não pôde ser removida."); } }, onError: () => setAviso("Resultado não confirmado ou origem alterada. Repita a mesma tentativa; procure suporte em conflito."), onSettled: () => { trava.current = false; } });
  const fotografia = JSON.stringify([clienteId, planoId, revisao, tipoTarefaId, disponivel]);
  function enviar(p: Pedido, repetir = false) { if (trava.current) return; try { const salvo = sessionStorage.getItem(chave); if (repetir ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error("Tentativa divergente."); if (!repetir) sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar ou conferir tentativa."); return; } setPendente(p); trava.current = true; envio.mutate(p); }
  return <section aria-label="Referência do tipo de tarefa legado"><p>Preserva o identificador da origem para a Rotina inicial. Isso não configura a OS nem envia tarefa.</p>
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>Repetir tentativa</button> : !pendente && <><label><input type="checkbox" checked={confirmado === fotografia} disabled={!disponivel || envio.isPending} onChange={(e) => setConfirmado(e.target.checked ? fotografia : null)} /> Conferi origem, tipo de tarefa e revisão.</label><button type="button" disabled={!disponivel || confirmado !== fotografia || envio.isPending} onClick={() => enviar(pedido.parse({ requestId: crypto.randomUUID(), clienteId, planoId, revisao, tipoTarefaId }))}>Preservar referência</button></>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
