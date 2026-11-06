import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { RegistrarOcorrenciaGrupo } from "./RegistrarOcorrenciaGrupo";
import { ReabrirGrupoFila } from "./ReabrirGrupoFila";

const uuid = z.string().uuid();
const previaSchema = z.object({ tipo: z.enum(["calendario", "visita"]), preparadaId: uuid, cicloId: uuid, grupoId: uuid, filaRevisao: z.number().int().positive(), filaEstado: z.enum(["aguardando", "verificacao", "cancelado"]), gruposRegistrados: z.number().int().nonnegative(), efeitosLocais: z.number().int().nonnegative(), fotografiaHash: z.string().regex(/^[a-f0-9]{64}$/), confirmavel: z.boolean(), fontesExternasComprovadas: z.literal(false), declaracaoAtual: z.boolean(), podeReabrir: z.boolean() }).strict();
const pedidoSchema = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, preparadaId: uuid, tipo: z.enum(["calendario", "visita"]), filaRevisao: z.number().int().positive(), fotografiaHash: z.string().regex(/^[a-f0-9]{64}$/), fontes: z.string().trim().min(1).max(2000), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; planoId: string; preparadaId: string; tipo: "calendario" | "visita" };
export function ConferirGrupoFila(props: Props) { return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.preparadaId, props.tipo])} {...props} />; }
function Conteudo({ userId, clienteId, planoId, preparadaId, tipo }: Props) {
  const cache = useQueryClient(); const trava = useRef(false); const chave = `sso-fila-grupo-declaracao:${JSON.stringify([userId, clienteId, planoId, preparadaId, tipo])}`;
  const [fontes, setFontes] = useState(""); const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.clienteId === clienteId && p.planoId === planoId && p.preparadaId === preparadaId && p.tipo === tipo ? p : "invalido"; } catch { return "invalido"; } });
  const previa = useQuery({ queryKey: ["grupo-fila-conferencia", userId, clienteId, planoId, preparadaId, tipo], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { await conferirSessaoDiagnostico(userId, signal); const { data, error } = await supabase.schema("pcm").rpc("sso_prever_fila_grupo_v2", { p_ator: userId, p_cliente: clienteId, p_plano: planoId, p_preparada: preparadaId, p_tipo: tipo }).abortSignal(signal); if (error) throw error; const r = previaSchema.parse(data); if (r.preparadaId !== preparadaId || r.tipo !== tipo) throw new Error("Identidade divergente."); await conferirSessaoDiagnostico(userId, signal); return r; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => { await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_declarar_fila_grupo_confirmado", { p_ator: userId, p_request: p.requestId, p_cliente: p.clienteId, p_plano: p.planoId, p_preparada: p.preparadaId, p_tipo: p.tipo, p_fila_revisao: p.filaRevisao, p_fotografia_hash: p.fotografiaHash, p_fontes: p.fontes, p_motivo: p.motivo, p_nao_identificou_execucao: true });
    if (error) throw error; const r = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, preparadaId: uuid, tipo: z.enum(["calendario", "visita"]), cicloId: uuid, grupoId: uuid, filaAlterada: z.literal(false), osAlteradas: z.literal(false), fontesExternasComprovadas: z.literal(false), declaracaoExplicita: z.literal(true) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.clienteId !== clienteId || r.planoId !== planoId || r.preparadaId !== preparadaId || r.tipo !== tipo) throw new Error("Recibo divergente."); await conferirSessaoDiagnostico(userId); },
    onSuccess: async (_r, p) => { try { await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave); } catch { setAviso("Declaração registrada, mas tentativa não removida. Procure suporte."); return; }
      setPendente(null); setConfirmacao(null); setAviso("Declaração PCM registrada. Confira e confirme a fila separadamente; fontes externas não foram comprovadas.");
      await Promise.all([cache.invalidateQueries({ queryKey: ["grupo-fila-conferencia", userId, clienteId, planoId, preparadaId, tipo] }), cache.invalidateQueries({ queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId] })]); },
    onError: () => setAviso("Resultado não confirmado ou fotografia alterada. Repita a mesma tentativa; em conflito procure suporte."), onSettled: () => { trava.current = false; } });
  const atual = !previa.isFetching && !previa.isError ? previa.data : undefined;
  const fotografia = atual ? JSON.stringify([userId, clienteId, planoId, preparadaId, tipo, atual, fontes.trim(), motivo.trim()]) : null;
  const enviar = (p: Pedido) => { if (trava.current) return; try { const salvo = sessionStorage.getItem(chave); if (pendente ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error(); if (!pendente) sessionStorage.setItem(chave, JSON.stringify(p)); trava.current = true; setPendente(p); envio.mutate(p); } catch { setAviso("Tentativa não pôde ser guardada; nada enviado."); } };
  return <section aria-label="Conferência de Grupo na fila"><p>A decisão é uma declaração PCM das fontes consultadas; não comprova ausência de execução fora das fontes conhecidas. A fila só muda após confirmação separada.</p>
    {previa.isFetching && <p role="status">Conferindo Grupo…</p>}{previa.isError && <p role="alert">Grupo ou fila indisponíveis para conferência. <button type="button" onClick={() => void previa.refetch()}>Tentar novamente</button></p>}
    {atual && <><p>Grupo {atual.grupoId} · identidades registradas {atual.gruposRegistrados} · efeitos locais associados {atual.efeitosLocais} · revisão da fila {atual.filaRevisao}.</p>
      {atual.gruposRegistrados === 0 && <><p>Registre a identidade do Grupo nesta ocorrência; depois atualize a conferência.</p>{import.meta.env.VITE_SSO_REGISTRAR_OCORRENCIA_GRUPO_ENABLED === "true" && <RegistrarOcorrenciaGrupo userId={userId} clienteId={clienteId} planoId={planoId} tipo={tipo} preparadaId={preparadaId} />}</>}
      {atual.podeReabrir && <ReabrirGrupoFila userId={userId} clienteId={clienteId} planoId={planoId} preparadaId={preparadaId} tipo={tipo} revisao={atual.filaRevisao} />}
      {atual.filaEstado === "aguardando" && atual.declaracaoAtual && <p>Declaração PCM atual nas fontes conferidas; isso não comprova fontes externas.</p>}
      {atual.filaEstado === "verificacao" && !atual.confirmavel && atual.gruposRegistrados > 0 && <p role="alert">A fila ou os efeitos conhecidos exigem reconciliação; não é possível registrar esta declaração.</p>}
      <button type="button" disabled={previa.isFetching} onClick={() => void previa.refetch()}>Atualizar conferência do Grupo</button>
      {atual.confirmavel && !pendente && <><label>Fontes consultadas <textarea maxLength={2000} value={fontes} onChange={(e) => { setFontes(e.target.value); setConfirmacao(null); }} /></label><label>Motivo da decisão PCM <textarea maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label><label><input type="checkbox" checked={!!fotografia && confirmacao === fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Declaro que conferi o Grupo e não identifiquei execução nas fontes informadas; outras fontes podem estar incompletas.</label><button type="button" disabled={!fotografia || confirmacao !== fotografia || !fontes.trim() || !motivo.trim() || envio.isPending} onClick={() => enviar({ requestId: crypto.randomUUID(), clienteId, planoId, preparadaId, tipo, filaRevisao: atual.filaRevisao, fotografiaHash: atual.fotografiaHash, fontes: fontes.trim(), motivo: motivo.trim() })}>Registrar declaração PCM</button></>}
    </>}
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir mesma declaração</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
