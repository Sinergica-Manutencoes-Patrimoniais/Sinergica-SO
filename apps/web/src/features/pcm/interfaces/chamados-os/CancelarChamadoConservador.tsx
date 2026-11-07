import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
type Pedido = { requestId: string; clienteId: string; chamadoId: string; revision: number; motivo: string };

type Props = { usuario: string; cliente: string; chamado: string; revision: number; incompleto: boolean };
export function CancelarChamadoConservador(props: Props) {
  return <CancelarChamadoConservadorInterno key={JSON.stringify([props.usuario, props.cliente, props.chamado])} {...props} />;
}
function CancelarChamadoConservadorInterno({ usuario, cliente, chamado, revision, incompleto }: Props) {
  const cache = useQueryClient(); const storageKey = `sso-cancelar-chamado:${JSON.stringify([usuario, cliente, chamado])}`;
  const trava = useRef(false);
  async function conferirSessao() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== usuario) throw new Error("Sessão alterada."); }
  const [motivo, setMotivo] = useState(""); const [confirmado, setConfirmado] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const fotografia = JSON.stringify([usuario, cliente, chamado, revision, motivo.trim()]);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(storageKey); if (!raw) return null; const p = JSON.parse(raw) as Pedido;
    return p.clienteId === cliente && p.chamadoId === chamado && typeof p.requestId === "string" && Number.isSafeInteger(p.revision) && typeof p.motivo === "string" ? p : "invalido";
  } catch { return "invalido"; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => { await conferirSessao(); if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error("Tentativa alterada."); const { data, error } = await supabase.schema("pcm").rpc("sso_cancelar_chamado_conservador", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_chamado_id: p.chamadoId, p_expected_revision: p.revision, p_motivo: p.motivo }); if (error) throw error; await conferirSessao(); if (!data || data.requestId !== p.requestId || data.osAlteradas !== false || data.state !== "cancelado") throw new Error("Resposta inválida."); }, onSuccess: async (_resultado, p) => { await cache.invalidateQueries({ queryKey: ["gestao-escopo-chamado", usuario, cliente, chamado] }); await cache.invalidateQueries({ queryKey: ["chamado-escopo-avaliacao", usuario, cliente, chamado] }); try { await conferirSessao(); if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) { setAviso("Transição registrada, mas tentativa local alterada. Reabra para conferir."); return; } sessionStorage.removeItem(storageKey); } catch { setAviso("Tentativa local não pôde ser removida; procure suporte."); return; } setPendente(null); setConfirmado(null); setAviso("Cancelamento registrado; nenhuma OS foi alterada.");   }, onError: () => setAviso("Resultado não confirmado, gate ou escopo pode impedir. Repita a mesma tentativa; procure suporte em conflito."), onSettled: () => { trava.current = false; } });
  const enviar = (p: Pedido) => { if (trava.current) return; try { const salvo = sessionStorage.getItem(storageKey); if (pendente ? salvo !== JSON.stringify(p) : salvo !== null) { setAviso("Tentativa local alterada. Reabra para conferir."); return; } if (!pendente) sessionStorage.setItem(storageKey, JSON.stringify(p)); } catch { setAviso("Não foi possível guardar ou conferir tentativa; nada enviado."); return; } setPendente(p); trava.current = true; envio.mutate(p); };
  return <section aria-label="Cancelamento conservador do Chamado"><h4>Cancelar Chamado</h4><p>Preparado sob gate fechado. Somente escopo integral já atendido, sem OS ativa ou continuidade pendente; parcelas não resolvidas ficam bloqueadas até devolução segura ao Backlog. Não altera OS nem aciona Auvo.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (pendente || incompleto || confirmado !== fotografia || !motivo.trim()) return; enviar({ requestId: crypto.randomUUID(), clienteId: cliente, chamadoId: chamado, revision, motivo: motivo.trim() }); }}>
      <fieldset disabled={!!pendente || envio.isPending || incompleto}><label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>{" "}
      <label><input type="checkbox" checked={confirmado === fotografia} onChange={(e) => setConfirmado(e.target.checked ? fotografia : null)} /> Conferi o escopo e autorizo cancelar somente o Chamado</label><button type="submit" disabled={confirmado !== fotografia}>Cancelar Chamado</button></fieldset>
    </form>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
