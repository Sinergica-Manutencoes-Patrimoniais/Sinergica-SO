import { Button } from "@sinergica/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid(); const revisao = z.number().int().positive(); const hash = z.string().regex(/^[a-f0-9]{64}$/);
const estadoSchema = z.object({ clienteId: id, cicloId: id, parcelaId: id, propostaId: id, cicloEstado: z.enum(["em_tratamento", "devolvido", "concluido"]),
  cicloRevision: revisao, parcelaSituacao: z.string(), osId: id, osStatus: z.string(), propostaSituacao: z.string(), possuiOsContinuacao: z.boolean(),
  descricaoRestante: z.string().min(1).max(4000), minutosRestantes: revisao, propostaSha256: hash, vinculoRequestId: id.nullable(),
  suspensaoEstado: z.enum(["suspenso", "retomado"]).nullable(), suspensaoRevision: revisao.nullable(), interrupcaoEstado: z.enum(["declarada", "revogada"]).nullable(),
  interrupcaoRevision: revisao.nullable(), revisaoHumana: revisao.nullable(), revisaoOsId: id.nullable(), revisaoAtendida: z.boolean().nullable(), paradaComprovada: z.literal(false) }).strict();
const pedidoSchema = z.object({ requestId: id, atorId: id, clienteId: id, composicaoId: id, cicloId: id, parcelaId: id, propostaId: id, retornoId: id,
  cicloRevision: revisao, suspensaoRevision: revisao, interrupcaoRevision: revisao, revisaoHumana: revisao, vinculoRequestId: id,
  propostaSha256: hash, motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const reciboSchema = z.object({ requestId: id, clienteId: id, cicloId: id, retornoId: id, revision: revisao, estado: z.literal("aguardando"), tipo: z.literal("parcial"),
  descricaoRestante: z.string().min(1).max(4000), minutosRestantes: revisao, paradaComprovada: z.literal(false), promovido: z.literal(false) }).strict();

export function DevolverParcialCiclo({ userId, clienteId, composicaoId, cicloId, parcelaId, propostaId }: {
  userId: string; clienteId: string; composicaoId: string; cicloId: string; parcelaId: string; propostaId: string;
}) {
  const chave = `sso-retorno-parcial:${userId}:${clienteId}:${cicloId}:${parcelaId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.composicaoId !== composicaoId || pedido.cicloId !== cicloId || pedido.parcelaId !== parcelaId) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState(""); const trava = useRef(false); const cache = useQueryClient();
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  const consulta = useQuery({ queryKey: ["backlog-retorno-parcial-contexto", userId, clienteId, cicloId, propostaId], gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => { await conferirAtor(); const parametros = { p_cliente_id: clienteId, p_ciclo_id: cicloId, p_proposta_id: propostaId };
      const requisicao = import.meta.env.VITE_SSO_RETORNO_PARCIAL_MEDIADO_ENABLED === "true"
        ? supabase.schema("pcm").rpc("sso_consultar_retorno_parcial_mediado", { ...parametros, p_ator_id: userId })
        : supabase.schema("pcm").rpc("sso_consultar_retorno_parcial", parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const r = estadoSchema.parse(data);
      if (r.clienteId !== clienteId || r.cicloId !== cicloId || r.parcelaId !== parcelaId || r.propostaId !== propostaId) throw new Error("Contexto divergente");
      await conferirAtor(); return r; } });
  const atual = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  const elegivel = atual && atual.cicloEstado === "em_tratamento" && atual.parcelaSituacao === "pendente" && atual.osStatus === "finalizado"
    && atual.propostaSituacao === "pendente" && !atual.possuiOsContinuacao && atual.vinculoRequestId && atual.suspensaoEstado === "suspenso"
    && atual.suspensaoRevision && atual.interrupcaoEstado === "declarada" && atual.interrupcaoRevision && atual.revisaoHumana
    && atual.revisaoAtendida === false && atual.revisaoOsId === atual.osId;
  const fotografia = atual ? JSON.stringify({ atual, motivo: motivo.trim() }) : null;
  async function enviar(pedido: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const nome = import.meta.env.VITE_SSO_RETORNO_PARCIAL_MEDIADO_ENABLED === "true" ? "sso_devolver_continuacao_parcial_mediado" : "sso_devolver_continuacao_parcial";
      const { data, error } = await supabase.schema("pcm").rpc(nome, {
        p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId, p_cliente_id: pedido.clienteId, p_ciclo_id: pedido.cicloId,
        p_retorno_id: pedido.retornoId, p_ciclo_revision: pedido.cicloRevision, p_suspensao_revision: pedido.suspensaoRevision,
        p_interrupcao_revision: pedido.interrupcaoRevision, p_revisao_humana: pedido.revisaoHumana, p_vinculo_request_id: pedido.vinculoRequestId,
        p_proposta_sha256: pedido.propostaSha256, p_motivo: pedido.motivo });
      if (error) throw error; const r = reciboSchema.parse(data);
      if (r.requestId !== pedido.requestId || r.clienteId !== clienteId || r.cicloId !== cicloId || r.retornoId !== pedido.retornoId || r.revision !== pedido.cicloRevision + 1) throw new Error("Recibo divergente");
      await conferirAtor(); await Promise.all([
        cache.invalidateQueries({ queryKey: ["backlog-retorno-parcial-contexto", userId, clienteId, cicloId] }),
        cache.invalidateQueries({ queryKey: ["backlog-retornos-parciais", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["backlog-candidatos-ciclo", userId, clienteId, composicaoId] }),
        cache.invalidateQueries({ queryKey: ["backlog-ciclos-posteriores", userId, clienteId, composicaoId] }),
      ]); await conferirAtor();
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo(""); setAviso("Retorno parcial registrado. Parada remota e promoção não foram comprovadas.");
    } catch { setAviso("Não foi possível confirmar o retorno. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function consultarRecibo(p: Pedido) {
    if (trava.current) return; trava.current = true; setOcupado(true); setAviso("");
    const serializado = JSON.stringify(p);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const payload = { clienteId: p.clienteId.toLowerCase(), cicloId: p.cicloId.toLowerCase(), retornoId: p.retornoId.toLowerCase(),
        cicloRevision: p.cicloRevision, suspensaoRevision: p.suspensaoRevision, interrupcaoRevision: p.interrupcaoRevision,
        revisaoHumana: p.revisaoHumana, vinculoRequestId: p.vinculoRequestId.toLowerCase(), propostaSha256: p.propostaSha256, motivo: p.motivo.trim() };
      const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_devolucao_parcial", { p_ator_id: userId,
        p_cliente_id: clienteId, p_ciclo_id: cicloId, p_request_id: p.requestId, p_payload: payload });
      if (error) throw error; const r = reciboSchema.parse(data);
      if (r.requestId !== p.requestId || r.clienteId !== clienteId || r.cicloId !== cicloId || r.retornoId !== p.retornoId || r.revision !== p.cicloRevision + 1) throw new Error("Recibo divergente");
      await cache.invalidateQueries({ queryKey: ["backlog-retorno-parcial-contexto", userId, clienteId, cicloId], refetchType: "none" });
      await cache.invalidateQueries({ queryKey: ["backlog-retornos-parciais", userId, clienteId], refetchType: "none" });
      await cache.invalidateQueries({ queryKey: ["backlog-candidatos-ciclo", userId, clienteId, composicaoId], refetchType: "none" });
      await cache.invalidateQueries({ queryKey: ["backlog-ciclos-posteriores", userId, clienteId, composicaoId], refetchType: "none" });
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso("Retorno parcial confirmado. Parada remota e promoção não foram comprovadas.");
      void cache.refetchQueries({ queryKey: ["backlog-retornos-parciais", userId, clienteId], type: "active" });
      void cache.refetchQueries({ queryKey: ["backlog-retorno-parcial-contexto", userId, clienteId, cicloId], type: "active" });
      void cache.refetchQueries({ queryKey: ["backlog-candidatos-ciclo", userId, clienteId, composicaoId], type: "active" });
      void cache.refetchQueries({ queryKey: ["backlog-ciclos-posteriores", userId, clienteId, composicaoId], type: "active" });
    } catch { setAviso("Recibo indisponível. A tentativa permanece guardada; ausência de confirmação não prova falha."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido || !atual || !elegivel || !fotografia || confirmacao !== fotografia) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, composicaoId, cicloId, parcelaId, propostaId,
        retornoId: crypto.randomUUID(), cicloRevision: atual.cicloRevision, suspensaoRevision: atual.suspensaoRevision, interrupcaoRevision: atual.interrupcaoRevision,
        revisaoHumana: atual.revisaoHumana, vinculoRequestId: atual.vinculoRequestId, propostaSha256: atual.propostaSha256, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira dados, motivo e sessão."); }
  }
  return <section aria-label="Retorno parcial da continuidade" className="mt-2 rounded-md border border-line p-3">
    <h5>Retorno parcial</h5><p>Este registro usa somente o restante declarado. Não comprova cobertura, parada remota nem cria execução.</p>
    {consulta.isFetching && <p role="status">Consultando condições…</p>}{consulta.isError && <p role="alert">Condições indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {atual && <><p>Restante: {atual.descricaoRestante} · {atual.minutosRestantes} min. OS {atual.osStatus}; ciclo {atual.cicloEstado}; parcela {atual.parcelaSituacao}.</p>
      <p>Suspensão {atual.suspensaoEstado ?? "ausente"} · interrupção {atual.interrupcaoEstado ?? "ausente"} · revisão humana {atual.revisaoHumana ?? "ausente"} · vínculo {atual.vinculoRequestId ? "declarado" : "ausente"}.</p>
      {!elegivel && <p>Condições carregadas não permitem registrar o retorno neste caminho.</p>}</>}
    {recuperacao.invalido ? <p role="alert">Tentativa local inválida. Procure suporte.</p> : pendente ? <><p>Há retorno pendente para proposta {pendente.propostaId}; a resposta pode ter sido perdida.</p><Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button>
      {import.meta.env.VITE_SSO_RECIBO_DEVOLUCAO_PARCIAL_ENABLED === "true" && <Button variant="secondary" disabled={ocupado} onClick={() => void consultarRecibo(pendente)}>Consultar confirmação</Button>}</> : <>
      <label>Motivo <textarea className="input" maxLength={2000} value={motivo} disabled={ocupado || !elegivel} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      {confirmacao && confirmacao !== fotografia && <p role="alert">Os dados mudaram. Confira novamente.</p>}
      <label><input type="checkbox" checked={Boolean(fotografia && confirmacao === fotografia)} disabled={ocupado || !elegivel || !fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmo o restante e as revisões exibidas.</label>
      <Button variant="secondary" disabled={ocupado || !elegivel || !fotografia || confirmacao !== fotografia || !motivo.trim()} onClick={iniciar}>Registrar retorno parcial</Button>
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
