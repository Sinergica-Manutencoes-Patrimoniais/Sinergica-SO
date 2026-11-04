import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { DespesaVisitaListada } from "../../infrastructure/supabase-despesas-visita-adapter";

const esquema = z.object({ requestId: z.string().uuid(), despesaId: z.string().uuid(), visitaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(), acao: z.enum(["corrigir", "cancelar"]),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), descricao: z.string().trim().min(1).max(10000).nullable(),
  motivo: z.string().trim().min(1).max(2000), conferencia: z.string().trim().min(1).max(2000) }).strict()
  .refine((p) => p.acao === "corrigir" ? p.data !== null && p.descricao !== null : p.data === null && p.descricao === null);
type Pedido = z.infer<typeof esquema>;
type Props = { userId: string; clienteId: string; visitaId: string; despesa: DespesaVisitaListada };
export function CorrigirRealizada(props: Props) {
  if (import.meta.env.VITE_SSO_CORRIGIR_DESPESA_REALIZADA_ENABLED !== "true" || props.despesa.status !== "ativa" || props.despesa.realizadoCentavos === null) return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.visitaId, props.despesa.id])} {...props} />;
}
function Conteudo({ userId, clienteId, visitaId, despesa }: Props) {
  const chave = `sso-corrigir-realizada:${userId}:${clienteId}:${visitaId}:${despesa.id}`;
  const queryClient = useQueryClient();
  const enviando = useRef(false);
  const [data, setData] = useState(despesa.data); const [descricao, setDescricao] = useState(despesa.descricao);
  const [motivo, setMotivo] = useState(""); const [conferencia, setConferencia] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [mensagem, setMensagem] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = esquema.parse(JSON.parse(salvo)); return p.despesaId === despesa.id && p.visitaId === visitaId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const fotografia = JSON.stringify([userId, clienteId, visitaId, despesa.id, despesa.revisao, despesa.data, despesa.descricao, data, descricao, motivo, conferencia]);
  const confirmado = confirmacao === fotografia;
  async function conferirSessao() { const { data: sessao, error } = await supabase.auth.getUser(); if (error || sessao.user?.id !== userId) throw new Error("Sessão alterada."); }
  const enviar = useMutation({ mutationFn: async (p: Pedido) => {
    await conferirSessao();
    if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa local divergente.");
    const { data: resposta, error } = await supabase.schema("pcm").rpc("sso_corrigir_despesa_realizada", {
      p_request_id: p.requestId, p_despesa_id: p.despesaId, p_expected_revision: p.expectedRevision,
      p_acao: p.acao, p_data: p.data, p_descricao: p.descricao, p_motivo: p.motivo, p_conferencia_financeira: p.conferencia });
    if (error) throw error;
    if (!resposta || resposta.requestId !== p.requestId || resposta.aggregateId !== p.despesaId ||
      resposta.revision !== p.expectedRevision + 1 || resposta.linkedIds?.visitaId !== p.visitaId ||
      resposta.state !== (p.acao === "cancelar" ? "cancelada" : "ativa")) throw new Error("Resposta inválida.");
    await conferirSessao();
  }, onSuccess: async (_resultado, p) => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: ["relatorio-despesas-cliente", userId, clienteId], refetchType: "none" }),
      ]);
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) {
        setMensagem("Operação confirmada, mas tentativa local mudou. Procure suporte; ela foi preservada.");
        return;
      }
      sessionStorage.removeItem(chave);
    } catch { setMensagem("Operação registrada; contate suporte para limpar tentativa local."); return; }
    setPendente(null); setConfirmacao(null); setMensagem("Alteração registrada. O comprovante e o Financeiro permanecem intactos.");
    void queryClient.refetchQueries({ queryKey: ["despesas-visita", userId, clienteId, visitaId], type: "active" });
    void queryClient.refetchQueries({ queryKey: ["relatorio-despesas-cliente", userId, clienteId], type: "active" });
  }, onError: () => setMensagem("Resultado não confirmado. Repita a mesma tentativa ou procure suporte."),
  onSettled: () => { enviando.current = false; } });
  function registrar(p: Pedido) {
    if (enviando.current) return;
    try {
      const anterior = sessionStorage.getItem(chave);
      const novo = JSON.stringify(p);
      if (anterior !== null && anterior !== novo) throw new Error("Tentativa divergente.");
      if (anterior === null && pendente) throw new Error("Tentativa ausente.");
      if (anterior === null) sessionStorage.setItem(chave, novo);
    } catch { setMensagem("Não foi possível guardar tentativa; operação não enviada."); return; }
    enviando.current = true; setPendente(p); setMensagem(""); enviar.mutate(p);
  }
  function iniciar(acao: "corrigir" | "cancelar") {
    if (pendente || enviar.isPending || enviando.current || !confirmado) return;
    try { registrar(esquema.parse({ requestId: crypto.randomUUID(), despesaId: despesa.id, visitaId,
      expectedRevision: despesa.revisao, acao, data: acao === "corrigir" ? data : null,
      descricao: acao === "corrigir" ? descricao : null, motivo, conferencia })); }
    catch { setMensagem("Confira data, descrição, motivo e conferência financeira."); }
  }
  return <section aria-label="Correção de despesa realizada"><h5>Corrigir ou cancelar</h5>
    <p>Valor e comprovante não são alterados. Casos com efeito Financeiro exigem fluxo de estorno e reconciliação.</p>
    <fieldset disabled={!!pendente || enviar.isPending}>
      <label>Data <input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label>Descrição <textarea maxLength={10000} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
      <label>Motivo <textarea maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <label>Como conferiu vínculos financeiros <textarea maxLength={2000} value={conferencia} onChange={(e) => setConferencia(e.target.value)} /></label>
      <label><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi os dados e a revisão financeira.</label>
      <button type="button" disabled={!confirmado} onClick={() => iniciar("corrigir")}>Corrigir dados</button>
      <button type="button" disabled={!confirmado} onClick={() => iniciar("cancelar")}>Cancelar despesa</button>
    </fieldset>
    {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Contate suporte.</p>}
    {pendente && pendente !== "invalido" && <button type="button" disabled={enviar.isPending} onClick={() => registrar(pendente)}>Repetir tentativa</button>}
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
