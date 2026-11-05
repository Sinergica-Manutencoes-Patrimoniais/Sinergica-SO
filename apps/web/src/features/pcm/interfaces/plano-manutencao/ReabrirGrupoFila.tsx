import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
const uuid = z.string().uuid();
const pedidoSchema = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, preparadaId: uuid, tipo: z.enum(["calendario", "visita"]), revisao: z.number().int().positive(), motivo: z.string().trim().min(1).max(2000), tentativaIncerta: z.boolean().optional() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; planoId: string; preparadaId: string; tipo: "calendario" | "visita"; revisao: number };
export function ReabrirGrupoFila(props: Props) { return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.preparadaId, props.tipo])} {...props} />; }
function Conteudo({ userId, clienteId, planoId, preparadaId, tipo, revisao }: Props) {
  const cache = useQueryClient(); const trava = useRef(false); const chave = `sso-fila-grupo-reabrir:${JSON.stringify([userId, clienteId, planoId, preparadaId, tipo])}`;
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.clienteId === clienteId && p.planoId === planoId && p.preparadaId === preparadaId && p.tipo === tipo ? p : "invalido"; } catch { return "invalido"; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => { await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const jaIncerta = p.tentativaIncerta !== false;
    const enviado = pedidoSchema.parse({ ...p, tentativaIncerta: true });
    sessionStorage.setItem(chave, JSON.stringify(enviado)); setPendente(enviado);
    const { data, error } = await supabase.schema("pcm").rpc("sso_reabrir_fila_grupo", { p_ator: userId, p_request: p.requestId, p_cliente: p.clienteId, p_plano: p.planoId, p_preparada: p.preparadaId, p_tipo: p.tipo, p_fila_revisao: p.revisao, p_motivo: p.motivo });
    if (error) {
      if (!jaIncerta && (error.code === "P0012" && error.message === "fila_ou_revisao_indisponivel")) {
        await conferirSessaoDiagnostico(userId);
        if (sessionStorage.getItem(chave) !== JSON.stringify(enviado)) throw new Error("Tentativa alterada.");
        sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null);
        await Promise.all([cache.invalidateQueries({ queryKey: ["grupo-fila-conferencia", userId, clienteId, planoId, preparadaId, tipo] }), cache.invalidateQueries({ queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId] })]);
        throw new Error("fila_rejeitada_definitivamente");
      }
      throw error;
    } const r = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, preparadaId: uuid, tipo: z.enum(["calendario", "visita"]), cicloId: uuid, estado: z.literal("verificacao"), revision: z.number().int().positive(), ocorrenciaCriada: z.literal(false), osAlteradas: z.literal(false), tarefaAuvoCriada: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.clienteId !== clienteId || r.planoId !== planoId || r.preparadaId !== preparadaId || r.tipo !== tipo || r.revision !== p.revisao + 1) throw new Error("Recibo divergente."); await conferirSessaoDiagnostico(userId); return enviado; },
    onSuccess: async (enviado) => { try { await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(enviado)) throw new Error(); sessionStorage.removeItem(chave); } catch { setAviso("Fila reaberta, mas tentativa local não removida. Procure suporte."); return; }
      setPendente(null); setConfirmacao(null); setAviso("Fila voltou para verificação. Registre nova declaração e confirme a fila separadamente.");
      await Promise.all([cache.invalidateQueries({ queryKey: ["grupo-fila-conferencia", userId, clienteId, planoId, preparadaId, tipo] }), cache.invalidateQueries({ queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId] })]); },
    onError: (erro) => setAviso(erro instanceof Error && erro.message === "fila_rejeitada_definitivamente" ? "A fila mudou antes da reabertura. Confira novamente os dados atualizados." : "Resultado não confirmado ou fila mudou. Repita a mesma tentativa; em conflito procure suporte."), onSettled: () => { trava.current = false; } });
  const foto = JSON.stringify([userId, clienteId, planoId, preparadaId, tipo, revisao, motivo.trim()]);
  const enviar = (p: Pedido) => { if (trava.current) return; try { const salvo = sessionStorage.getItem(chave); if (pendente ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error(); if (!pendente) sessionStorage.setItem(chave, JSON.stringify(p)); trava.current = true; setPendente(p); envio.mutate(p); } catch { setAviso("Tentativa não pôde ser guardada; nada enviado."); } };
  return <section aria-label="Reabrir conferência de Grupo"><p>A declaração anterior mudou ou não está comprovada. Retornar à verificação não altera a ocorrência nem OS existentes.</p>
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir mesma reabertura</button> : !pendente && <><label>Motivo da reabertura <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label><label><input type="checkbox" checked={confirmacao === foto} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Confirmo devolver esta fila à verificação.</label><button type="button" disabled={confirmacao !== foto || !motivo.trim() || envio.isPending} onClick={() => enviar({ requestId: crypto.randomUUID(), clienteId, planoId, preparadaId, tipo, revisao, motivo: motivo.trim(), tentativaIncerta: false })}>Reabrir conferência</button></>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
