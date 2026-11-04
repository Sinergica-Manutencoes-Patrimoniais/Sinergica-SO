import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { UnirChamadoCampo } from "./UnirChamadoCampo";
import { CancelarChamadoCampo } from "./CancelarChamadoCampo";

const uuid = z.string().uuid();
export const pedidoTriagemChamadoCampoSchema = z.object({ requestId: uuid, clienteId: uuid, osId: uuid, chamadoId: uuid,
  chamadoRevision: z.number().int().positive().safe(), triagemRevision: z.number().int().nonnegative().safe(),
  acao: z.enum(["confirmar", "corrigir"]), titulo: z.string().nullable(), descricao: z.string().nullable(), motivo: z.string().min(1).max(2000) }).strict();
const pedidoSchema = pedidoTriagemChamadoCampoSchema;
type Pedido = z.infer<typeof pedidoSchema>;
const contextoSchema = z.object({ clienteId: uuid, chamadoId: uuid, osId: uuid, titulo: z.string(), descricao: z.string().nullable(),
  chamadoRevision: z.number().int().positive().safe(), triagemRevision: z.number().int().nonnegative().safe(), triagemPendente: z.boolean(),
  statusChamado: z.string(), encerrado: z.boolean(), taskId: z.string().regex(/^[1-9]\d{0,18}$/).nullable(), osUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  osAlterada: z.literal(false), validacaoPcmComprovada: z.literal(false) }).strict();

export function TriagemChamadoProvisorio({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  if (import.meta.env.VITE_SSO_TRIAGEM_CHAMADO_CAMPO_ENABLED !== "true") return null;
  return <Conteudo key={`${userId}:${clienteId}:${osId}`} userId={userId} clienteId={clienteId} osId={osId} />;
}
function Conteudo({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const chave = `sso-triagem-chamado-campo:${JSON.stringify([userId, clienteId, osId])}`;
  const outrasChaves = ["sso-uniao-chamado-campo:", "sso-cancelamento-chamado-campo:"].map((prefixo) => `${prefixo}${JSON.stringify([userId, clienteId, osId])}`);
  const [acao, setAcao] = useState<"confirmar" | "corrigir">("confirmar");
  const [titulo, setTitulo] = useState(""); const [descricao, setDescricao] = useState(""); const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const trava = useRef(false); const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const raw = sessionStorage.getItem(chave); if (!raw) return null; const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.osId === osId ? p : "invalido"; } catch { return "invalido"; }
  });
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const contexto = useQuery({ queryKey: ["triagem-chamado-campo", userId, clienteId, osId], gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => { await conferirSessao(signal); const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_triagem_chamado_campo", { p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId }).abortSignal(signal);
      if (error) throw error; const r = contextoSchema.parse(data); if (r.clienteId !== clienteId || r.osId !== osId) throw new Error("Contexto divergente."); await conferirSessao(signal); return r; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao(); if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_decidir_triagem_chamado_campo", { p_ator_id: userId, p_cliente_id: p.clienteId, p_os_id: p.osId,
      p_request_id: p.requestId, p_expected_chamado: p.chamadoRevision, p_expected_triagem: p.triagemRevision, p_acao: p.acao,
      p_titulo: p.titulo, p_descricao: p.descricao, p_motivo: p.motivo });
    if (error) throw error;
    const r = z.object({ requestId: uuid, clienteId: uuid, osId: uuid, chamadoId: uuid, acao: z.enum(["confirmar", "corrigir"]),
      chamadoRevision: z.number().int().positive().safe(), triagemRevision: z.number().int().positive().safe(),
      osAlterada: z.literal(false), tarefaAlterada: z.literal(false), validacaoPcmComprovada: z.literal(false) }).strict().parse(data);
    if (r.requestId !== p.requestId || r.clienteId !== p.clienteId || r.osId !== p.osId || r.chamadoId !== p.chamadoId || r.acao !== p.acao || r.triagemRevision !== p.triagemRevision + 1) throw new Error("Recibo divergente.");
    await conferirSessao(); return r;
  }, onSuccess: async (_r, p) => {
    try { await cache.invalidateQueries({ queryKey: ["triagem-chamado-campo", userId, clienteId, osId], refetchType: "none" }); await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null);
      setAviso("Triagem registrada. OS e tarefa não foram alteradas."); void contexto.refetch();
    } catch { setAviso("Não foi possível confirmar a sessão ou tentativa. Consulte suporte."); }
  }, onError: () => setAviso("Resultado não confirmado. Preserve e repita a mesma tentativa ou consulte suporte."), onSettled: () => { trava.current = false; } });
  const atual = !contexto.isFetching && !contexto.isError ? contexto.data : undefined;
  const foto = JSON.stringify([userId, clienteId, osId, atual ?? null, acao, titulo, descricao, motivo.trim()]);
  const confirmado = confirmacao === foto;
  function executar(p: Pedido) { if (trava.current) return; try { if (sessionStorage.getItem(chave) !== JSON.stringify(p) || outrasChaves.some((k) => sessionStorage.getItem(k) !== null)) throw new Error(); } catch { setAviso("Há outra tentativa pendente ou divergente. Reconcilie antes de continuar."); return; } trava.current = true; envio.mutate(p); }
  function iniciar() {
    if (!atual || atual.encerrado || atual.statusChamado === "cancelado" || !confirmado || pendente || trava.current) return;
    try { const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, osId, chamadoId: atual.chamadoId,
      chamadoRevision: atual.chamadoRevision, triagemRevision: atual.triagemRevision, acao,
      titulo: acao === "corrigir" ? titulo.trim() : null, descricao: acao === "corrigir" ? descricao.trim() || null : null, motivo: motivo.trim() });
      if (acao === "corrigir" && !p.titulo) throw new Error(); if (sessionStorage.getItem(chave) || outrasChaves.some((k) => sessionStorage.getItem(k) !== null)) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); executar(p);
    } catch { setAviso("Confira dados, motivo e armazenamento. Nada foi enviado."); }
  }
  return <section aria-label="Triagem do Chamado provisório">
    <h4>Triagem do Chamado provisório</h4>
    <p>Confirmar ou corrigir o Chamado não altera a OS ou tarefa, nem valida a execução em campo.</p>
    {contexto.isFetching && <output>Consultando triagem…</output>}
    {contexto.isError && <p role="alert">Triagem indisponível. <button type="button" onClick={() => void contexto.refetch()}>Tentar novamente</button></p>}
    {atual && <p>Chamado {atual.chamadoId} · {atual.titulo} · {atual.triagemPendente ? "triagem pendente" : `triagem revisão ${atual.triagemRevision}`}. Descrição: {atual.descricao ?? "não informada"}.</p>}
    {atual && <UnirChamadoCampo userId={userId} clienteId={clienteId} osId={osId} origemId={atual.chamadoId} origemRevision={atual.chamadoRevision} osUpdatedAt={atual.osUpdatedAt} taskId={atual.taskId} disponivel={!pendente && !envio.isPending && !atual.encerrado && atual.statusChamado !== "cancelado"} />}
    {atual && <CancelarChamadoCampo userId={userId} clienteId={clienteId} osId={osId} chamadoId={atual.chamadoId} revision={atual.chamadoRevision} osUpdatedAt={atual.osUpdatedAt} taskId={atual.taskId} disponivel={!pendente && !envio.isPending && !atual.encerrado && atual.statusChamado !== "cancelado"} />}
    {pendente === "invalido" ? <p role="alert">Tentativa local inválida. Consulte suporte.</p> : pendente ? <button type="button" disabled={envio.isPending} onClick={() => executar(pendente)}>Repetir mesmo pedido</button> : atual && <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
      <label>Ação <select value={acao} onChange={(e) => { setAcao(e.target.value as typeof acao); setConfirmacao(null); }}><option value="confirmar">Confirmar dados</option><option value="corrigir">Corrigir dados</option></select></label>
      {acao === "corrigir" && <><button type="button" onClick={() => { setTitulo(atual.titulo); setDescricao(atual.descricao ?? ""); setConfirmacao(null); }}>Carregar dados atuais</button>
        <label>Título <input maxLength={200} value={titulo} onChange={(e) => { setTitulo(e.target.value); setConfirmacao(null); }} /></label>
        <label>Descrição <textarea maxLength={10000} value={descricao} onChange={(e) => { setDescricao(e.target.value); setConfirmacao(null); }} /></label></>}
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmacao(e.target.checked ? foto : null)} /> Conferi o Chamado, os dados e o motivo.</label>
      <button type="submit" disabled={!confirmado || !motivo.trim() || envio.isPending || atual.encerrado || atual.statusChamado === "cancelado"}>Registrar triagem</button>
    </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
