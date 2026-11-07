import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const pedidoSchema = z.object({ requestId: uuid, clienteId: uuid, retornoId: uuid, conferenciaId: uuid,
  evidencias: z.number().int().nonnegative(), decisao: z.number().int().nonnegative(), justificativa: z.string().trim().min(1).max(2000),
  osId: uuid, status: z.string().min(1), updatedAt: z.string().datetime({ offset: true }) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const previaSchema = z.object({ osId: uuid, status: z.string().min(1), updatedAt: z.string().datetime({ offset: true }).nullable(), chamadoAlterado: z.literal(false), notificacaoLegadaPossivel: z.literal(true) }).strict();
const respostaSchema = z.object({ requestId: uuid, retornoId: uuid, osId: uuid, revision: z.number().int().positive(), pendenciasProcessadas: z.number().int().nonnegative(), osEncerrada: z.literal(true), chamadoAlterado: z.literal(false), conteudoAutenticado: z.literal(false) }).strict();

/** Operação única: aprovação e encerramento individual sucedem ou falham juntos. */
export function AprovarFinalizarAtomico(props: Parameters<typeof Conteudo>[0]) { return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.retornoId, props.conferenciaId])} {...props} />; }
function Conteudo({ userId, clienteId, retornoId, conferenciaId, evidencias, decisao, historicoCompleto }: { userId: string; clienteId: string; retornoId: string; conferenciaId: string; evidencias: number; decisao: number; historicoCompleto: boolean }) {
  const montado = useRef(false); useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const chave = `sso-aprovacao-finalizacao:${JSON.stringify([userId, clienteId, retornoId, conferenciaId])}`;
  const cache = useQueryClient(); const trava = useRef(false);
  const [justificativa, setJustificativa] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null; const p = pedidoSchema.parse(JSON.parse(salvo)); return p.clienteId === clienteId && p.retornoId === retornoId && p.conferenciaId === conferenciaId ? p : "invalido"; } catch { return "invalido"; } });
  async function sessao(signal?: AbortSignal) { const r = await supabase.auth.getUser(); if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada."); }
  const previa = useQuery({ queryKey: ["retorno-previa-finalizacao-os", userId, clienteId, retornoId], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { await sessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_mediar_previa_finalizacao_os", { p_cliente_id: clienteId, p_retorno_id: retornoId }).abortSignal(signal); if (error) throw error; const r = previaSchema.parse(data); await sessao(signal); return r; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await sessao(); if (!montado.current) throw new Error("Tela desmontada."); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_aprovar_finalizar_os_atomico", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_retorno_id: p.retornoId, p_conferencia_id: p.conferenciaId, p_expected_evidencias: p.evidencias, p_expected_decisao: p.decisao, p_justificativa: p.justificativa, p_expected_os_id: p.osId, p_expected_status: p.status, p_expected_updated_at: p.updatedAt });
    if (error) throw error; const r = respostaSchema.parse(data);
    if (r.requestId !== p.requestId || r.retornoId !== p.retornoId || r.osId !== p.osId || r.revision !== p.decisao + 1) throw new Error("Resposta divergente.");
    await sessao(); if (!montado.current) throw new Error("Tela desmontada."); return r;
  }, onSuccess: async (r, p) => { try {
    await cache.invalidateQueries({ queryKey: ["retorno-previa-finalizacao-os", userId, clienteId, retornoId] });
    await cache.invalidateQueries({ queryKey: ["retorno-atestacoes-pcm", userId, clienteId, retornoId] });
    await cache.invalidateQueries({ queryKey: ["retorno-decisoes", userId, clienteId, retornoId] });
    await sessao(); if (!montado.current) throw new Error("Tela desmontada."); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
    sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setAviso(`Retorno aprovado e OS finalizada; ${r.pendenciasProcessadas} pendência(s) processada(s). Chamado não alterado.`);
  } catch { setAviso("Resultado confirmado, mas tentativa local não pôde ser removida. Procure suporte."); } }, onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa; procure suporte em caso de conflito."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido, repetir = false) { if (trava.current) return; try { const salva = sessionStorage.getItem(chave); if (repetir ? salva !== JSON.stringify(p) : salva !== null) throw new Error("Tentativa divergente."); if (!repetir) sessionStorage.setItem(chave, JSON.stringify(p)); } catch { setAviso("Não foi possível conferir ou guardar a tentativa."); return; } setPendente(p); trava.current = true; envio.mutate(p); }
  const dados = previa.data; const fotografia = JSON.stringify([clienteId, retornoId, conferenciaId, evidencias, decisao, historicoCompleto, justificativa.trim(), dados]);
  return <section aria-label="Aprovação e finalização da OS"><h5>Aprovar retorno e finalizar OS</h5>
    <p>A aprovação e a finalização individual são registradas juntas; o Chamado permanece aberto. A transição pode gerar notificação no Portal.</p>
    {previa.isFetching && <output>Consultando OS…</output>}{previa.isError && <p role="alert">OS indisponível. <button type="button" onClick={() => void previa.refetch()}>Tentar novamente</button></p>}
    {!historicoCompleto && <p>Histórico não reconciliado; aprovação bloqueada.</p>}
    {dados && !previa.isFetching && !previa.isError && <p>OS {dados.osId} · situação {dados.status} · atualização {dados.updatedAt ?? "indisponível"}.</p>}
    <label>Justificativa <textarea maxLength={2000} value={justificativa} disabled={!!pendente || envio.isPending} onChange={(e) => { setJustificativa(e.target.value); setConfirmacao(null); }} /></label>
    <label><input type="checkbox" checked={confirmacao === fotografia} disabled={!!pendente || !historicoCompleto || !dados?.updatedAt || previa.isFetching || previa.isError || !justificativa.trim()} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi o retorno e autorizo finalizar esta OS.</label>
    <button type="button" disabled={!!pendente || envio.isPending || !historicoCompleto || !dados?.updatedAt || previa.isFetching || previa.isError || confirmacao !== fotografia} onClick={() => { if (dados?.updatedAt) enviar(pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, retornoId, conferenciaId, evidencias, decisao, justificativa: justificativa.trim(), osId: dados.osId, status: dados.status, updatedAt: dados.updatedAt })); }}>Aprovar e finalizar</button>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}{pendente && pendente !== "invalido" && <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente, true)}>Repetir mesma tentativa</button>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
