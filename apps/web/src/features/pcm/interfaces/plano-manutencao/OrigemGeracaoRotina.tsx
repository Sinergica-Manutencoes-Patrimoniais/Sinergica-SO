import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

const pedidoSchema = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), planoId: z.string().uuid(), versaoId: z.string().uuid(), rotinaId: z.string().uuid(), revision: z.number().int().positive().safe(), origem: z.enum(["plano", "pmoc"]), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; planoId: string; versaoId: string; rotinaId: string; revision: number };
export function OrigemGeracaoRotina(props: Props) {
  if (import.meta.env.VITE_SSO_ORIGEM_ROTINA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.versaoId, props.rotinaId])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId, versaoId, rotinaId, revision }: Props) {
  const cache = useQueryClient(); const envioAtivo = useRef(false); const chave = `sso-origem-rotina:${JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId])}`;
  const [origem, setOrigem] = useState<Pedido["origem"]>("plano"); const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw)); return p.clienteId === clienteId && p.planoId === planoId && p.versaoId === versaoId && p.rotinaId === rotinaId ? p : "invalido"; } catch { return "invalido"; } });
  const identidade = JSON.stringify([clienteId, planoId, versaoId, rotinaId, revision, origem, motivo.trim()]);
  const queryKey = ["origem-rotina", userId, clienteId, planoId, versaoId, rotinaId, revision] as const;
  const consulta = useQuery({ queryKey, gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    await conferirSessaoDiagnostico(userId, signal);
    const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_origem_rotina", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_id: planoId, p_versao_id: versaoId, p_rotina_id: rotinaId, p_expected_revision: revision }).abortSignal(signal); if (error) throw error;
    const r = z.object({ planoId: z.string().uuid(), versaoId: z.string().uuid(), rotinaId: z.string().uuid(), revisao: z.number().int().positive(), rotinaLogicaId: z.string().uuid(), alvoTipo: z.enum(["sistema", "componente", "grupo"]), alvoId: z.string().uuid(), origem: z.enum(["plano", "pmoc"]).nullable(), exclusividadePmocComprovada: z.literal(false) }).strict().parse(data);
    if (r.planoId !== planoId || r.versaoId !== versaoId || r.rotinaId !== rotinaId || r.revisao !== revision) throw new Error("Contexto divergente."); await conferirSessaoDiagnostico(userId, signal); return r;
  } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_declarar_origem_rotina", { p_ator_id: userId, p_request_id: p.requestId, p_cliente_id: p.clienteId, p_plano_id: p.planoId, p_versao_id: p.versaoId, p_rotina_id: p.rotinaId, p_expected_revision: p.revision, p_origem: p.origem, p_motivo: p.motivo, p_confirma: true }); if (error) throw error;
    const r = z.object({ requestId: z.string().uuid(), planoId: z.string().uuid(), versaoId: z.string().uuid(), rotinaId: z.string().uuid(), origem: z.enum(["plano", "pmoc"]), exclusividadePmocComprovada: z.literal(false), ocorrenciaCriada: z.literal(false), osCriada: z.literal(false), tarefaAuvoCriada: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.planoId !== p.planoId || r.versaoId !== p.versaoId || r.rotinaId !== p.rotinaId || r.origem !== p.origem) throw new Error("Recibo divergente."); await conferirSessaoDiagnostico(userId);
  }, onSuccess: async (_r, p) => { try { await conferirSessaoDiagnostico(userId); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave); } catch { setAviso("Tentativa preservada; procure suporte."); return; } setPendente(null); setConfirmacao(null); setAviso("Origem declarada. A exclusividade com PMOC ainda precisa de conferência."); await Promise.all([cache.invalidateQueries({ queryKey }), cache.invalidateQueries({ queryKey: ["origem-efetiva-ciclo", userId, clienteId, planoId] }), cache.invalidateQueries({ queryKey: ["origens-lote", userId, clienteId, planoId] }), cache.invalidateQueries({ queryKey: ["avaliacao-inventario-pmoc", userId, clienteId, planoId] })]); }, onError: () => setAviso("Resultado não confirmado ou origem já diferente. Repita a tentativa; procure suporte se persistir."), onSettled: () => { envioAtivo.current = false; } });
  const enviar = (p: Pedido) => { if (envioAtivo.current) return; try { const anterior = sessionStorage.getItem(chave); if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setAviso("Não foi possível preservar a tentativa."); return; } envioAtivo.current = true; setPendente(p); envio.mutate(p); };
  const disponivel = !consulta.isFetching && !consulta.isError && !!consulta.data;
  return <section aria-label="Origem de geração da Rotina"><h4>Origem de geração</h4><p>Escolha por Rotina e alvo. A escolha não comprova exclusividade com PMOC e não altera agendas existentes.</p>
    {consulta.isFetching && <p role="status">Consultando origem...</p>}{consulta.isError && <p role="alert">Origem indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {disponivel && <p>Origem atual: {consulta.data?.origem ?? "não declarada"}.</p>}
    {disponivel && !consulta.data?.origem && <form onSubmit={(e) => { e.preventDefault(); if (pendente || envio.isPending || confirmacao !== identidade || !motivo.trim()) return; enviar({ requestId: crypto.randomUUID(), clienteId, planoId, versaoId, rotinaId, revision, origem, motivo: motivo.trim() }); }}><fieldset disabled={!!pendente || envio.isPending}><label>Origem <select value={origem} onChange={(e) => { setOrigem(e.target.value as Pedido["origem"]); setConfirmacao(null); }}><option value="plano">Plano</option><option value="pmoc">PMOC</option></select></label><label>Motivo <textarea value={motivo} maxLength={2000} required onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label><label><input type="checkbox" checked={confirmacao === identidade} onChange={(e) => setConfirmacao(e.target.checked ? identidade : null)} /> Confirmei a origem desta Rotina e alvo</label><button disabled={confirmacao !== identidade}>Declarar origem</button></fieldset></form>}
    {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir tentativa pendente</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
