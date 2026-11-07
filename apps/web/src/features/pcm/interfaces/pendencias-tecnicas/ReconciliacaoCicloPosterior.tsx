import { Button } from "@sinergica/ui";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
const estadoSchema = z.object({ parcelaId: id, situacao: z.string(), revision: z.number().int().nonnegative(), osId: id.nullable(),
  suspensao: z.enum(["suspenso", "retomado"]).nullable(), suspensaoRevision: z.number().int().positive().nullable(),
  interrupcao: z.enum(["declarada", "revogada"]).nullable(), interrupcaoRevision: z.number().int().positive().nullable() }).strict();
const evidenciaSchema = z.object({ evidencia_id: id, os_id: id, tipo: z.string(), referencia: z.string(), descricao: z.string() }).strict();
const historicoSchema = z.object({ revisao: z.number().int().positive(), os_id: id, evidencia_id: id,
  estado: z.enum(["nao_executada_declarada", "incerta"]), motivo: z.string(), ator_id: id, criado_em: z.string().datetime({ offset: true }) }).strict();
const pedidoSchema = z.object({ requestId: id, atorId: id, clienteId: id, composicaoId: id, cicloId: id, parcelaId: id, osId: id, evidenciaId: id,
  revision: z.number().int().nonnegative(), suspensaoRevision: z.number().int().positive(), interrupcaoRevision: z.number().int().positive(),
  estado: z.enum(["nao_executada_declarada", "incerta"]), motivo: z.string().trim().min(1).max(2000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function ReconciliacaoCicloPosterior({ userId, clienteId, composicaoId, cicloId, parcelaId }: {
  userId: string; clienteId: string; composicaoId: string; cicloId: string; parcelaId: string;
}) {
  const chave = `sso-reconciliacao-ciclo:${userId}:${clienteId}:${cicloId}:${parcelaId}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.composicaoId !== composicaoId || pedido.cicloId !== cicloId || pedido.parcelaId !== parcelaId) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [evidenciaId, setEvidenciaId] = useState("");
  const [osEscolhida, setOsEscolhida] = useState("");
  const [estado, setEstado] = useState<"nao_executada_declarada" | "incerta">("incerta");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  const raiz = ["backlog-reconciliacao-ciclo", userId, clienteId, cicloId, parcelaId] as const;
  async function conferirAtor() { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId) throw new Error("Sessão alterada"); }
  const cadeiaAtiva = import.meta.env.VITE_SSO_RECONCILIACAO_CADEIA_ENABLED === "true";
  const opcoesOs = useInfiniteQuery({ queryKey: [...raiz, "os-cadeia"], initialPageParam: null as string | null, gcTime: 0, enabled: cadeiaAtiva,
    queryFn: async ({ pageParam, signal }) => { await conferirAtor(); const { data, error } = await supabase.schema("pcm").rpc("sso_os_ciclo_posterior", {
      p_cliente_id: clienteId, p_ciclo_id: cicloId, p_modo: "interromper", p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(z.object({ os_id: id, numero: z.string() }).passthrough()).max(30).parse(data);
      let anterior = pageParam ?? ""; for (const item of pagina) { if (item.os_id <= anterior) throw new Error("Página divergente"); anterior = item.os_id; }
      await conferirAtor(); return pagina; }, getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.os_id : undefined });
  const opcoesAtuais = !opcoesOs.isFetching && !opcoesOs.isError ? (opcoesOs.data?.pages.flat() ?? []) : [];
  const osDisponivel = cadeiaAtiva && opcoesAtuais.some((item) => item.os_id === osEscolhida);
  const contexto = useQuery({ queryKey: [...raiz, "contexto", cadeiaAtiva ? osEscolhida : "legado"], gcTime: 0, refetchOnWindowFocus: true,
    enabled: !cadeiaAtiva || osDisponivel,
    queryFn: async ({ signal }) => { await conferirAtor(); const { data, error } = cadeiaAtiva
      ? await supabase.schema("pcm").rpc("sso_consultar_reconciliacao_ciclo_os", { p_cliente_id: clienteId, p_ciclo_id: cicloId, p_parcela_id: parcelaId, p_os_id: osEscolhida }).abortSignal(signal)
      : await supabase.schema("pcm").rpc("sso_consultar_reconciliacao_ciclo", { p_cliente_id: clienteId, p_ciclo_id: cicloId, p_parcela_id: parcelaId }).abortSignal(signal);
      if (error) throw error; const r = estadoSchema.parse(data); if (r.parcelaId !== parcelaId || (cadeiaAtiva && r.osId !== osEscolhida)) throw new Error("Contexto divergente"); await conferirAtor(); return r; } });
  const evidencias = useInfiniteQuery({ queryKey: [...raiz, "evidencias"], initialPageParam: null as string | null, gcTime: 0,
    queryFn: async ({ pageParam, signal }) => { await conferirAtor(); const { data, error } = await supabase.schema("pcm").rpc("sso_listar_evidencias_ciclo", {
      p_cliente_id: clienteId, p_ciclo_id: cicloId, p_parcela_id: parcelaId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(evidenciaSchema).max(30).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.evidencia_id <= anterior) throw new Error("Página divergente"); anterior = item.evidencia_id; }
      await conferirAtor(); return pagina; }, getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.evidencia_id : undefined });
  const historico = useInfiniteQuery({ queryKey: [...raiz, "historico"], initialPageParam: null as number | null, gcTime: 0,
    queryFn: async ({ pageParam, signal }) => { await conferirAtor(); const { data, error } = await supabase.schema("pcm").rpc("sso_listar_reconciliacoes_ciclo", {
      p_cliente_id: clienteId, p_ciclo_id: cicloId, p_parcela_id: parcelaId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(historicoSchema).max(30).parse(data); let anterior = pageParam ?? 0;
      for (const item of pagina) { if (item.revisao <= anterior) throw new Error("Página divergente"); anterior = item.revisao; }
      await conferirAtor(); return pagina; }, getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.revisao : undefined });
  const atual = (!cadeiaAtiva || osDisponivel) && !contexto.isFetching && !contexto.isError ? contexto.data : undefined;
  const lista = !evidencias.isFetching && !evidencias.isError ? (evidencias.data?.pages.flat() ?? []) : [];
  const evidencia = lista.find((item) => item.evidencia_id === evidenciaId && item.os_id === atual?.osId);
  const fotografia = atual && evidencia ? JSON.stringify({ atual, evidencia, estado, motivo: motivo.trim() }) : null;
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso(""); const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_reconciliar_parcela_ciclo", {
        p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId, p_cliente_id: pedido.clienteId, p_ciclo_id: pedido.cicloId,
        p_parcela_id: pedido.parcelaId, p_os_id: pedido.osId, p_evidencia_id: pedido.evidenciaId, p_expected_revision: pedido.revision,
        p_suspensao_revision: pedido.suspensaoRevision, p_interrupcao_revision: pedido.interrupcaoRevision, p_estado: pedido.estado, p_confirma: true, p_motivo: pedido.motivo,
      });
      if (error) throw error;
      const r = z.object({ requestId: id, parcelaId: id, revision: z.number().int().positive(), estado: z.enum(["nao_executada_declarada", "incerta"]), devolucaoAutorizada: z.literal(false) }).strict().parse(data);
      if (r.requestId !== pedido.requestId || r.parcelaId !== parcelaId || r.revision !== pedido.revision + 1 || r.estado !== pedido.estado) throw new Error("Recibo divergente");
      await conferirAtor(); await Promise.all([cache.invalidateQueries({ queryKey: raiz }), cache.invalidateQueries({ queryKey: ["backlog-ciclos-posteriores", userId, clienteId, composicaoId] })]);
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo(""); setAviso("Reconciliação registrada; devolução não foi autorizada.");
    } catch { setAviso("Não foi possível confirmar o registro. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido || !fotografia || confirmacao !== fotografia || !atual || !evidencia
      || atual.situacao !== "pendente" || atual.suspensao !== "suspenso" || atual.interrupcao !== "declarada" || !atual.osId || !atual.suspensaoRevision || !atual.interrupcaoRevision) return;
    try {
      const pedido = pedidoSchema.parse({ requestId: crypto.randomUUID(), atorId: userId, clienteId, composicaoId, cicloId, parcelaId, osId: atual.osId,
        evidenciaId: evidencia.evidencia_id, revision: atual.revision, suspensaoRevision: atual.suspensaoRevision, interrupcaoRevision: atual.interrupcaoRevision, estado, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira evidência, motivo e sessão."); }
  }
  return <section aria-label="Reconciliação do ciclo posterior" className="mt-2 rounded-md border border-line p-3">
    <h5>Reconciliação humana</h5><p>Declaração e evidência não comprovam parada remota nem autorizam devolução.</p>
    {cadeiaAtiva && <><label>OS a reconciliar <select className="input" value={osEscolhida} disabled={ocupado || opcoesOs.isFetching || opcoesOs.isError} onChange={(e) => { setOsEscolhida(e.target.value); setEvidenciaId(""); setConfirmacao(null); }}><option value="">Selecione</option>{opcoesAtuais.map((os) => <option key={os.os_id} value={os.os_id}>{os.numero} · {os.os_id}</option>)}</select></label>
      {opcoesOs.isError && <p role="alert">Não foi possível consultar as OS. <button type="button" onClick={() => void opcoesOs.refetch()}>Tentar novamente</button></p>}
      {opcoesOs.hasNextPage && <Button variant="secondary" disabled={opcoesOs.isFetching} onClick={() => void opcoesOs.fetchNextPage()}>Mais OS</Button>}</>}
    {contexto.isFetching && <p role="status">Consultando contexto...</p>}
    {contexto.isError && <p role="alert">Contexto indisponível. <button type="button" onClick={() => void contexto.refetch()}>Tentar novamente</button></p>}
    {atual && <p>Parcela {atual.situacao} · OS {atual.osId ?? "ausente"} · suspensão {atual.suspensao ?? "ausente"} · interrupção {atual.interrupcao ?? "ausente"} · revisão {atual.revision}.</p>}
    {historico.isError && <p role="alert">Histórico indisponível.</p>}
    {!historico.isFetching && !historico.isError && historico.data && <ol>{historico.data.pages.flat().map((r) => <li key={r.revisao}>Revisão {r.revisao} · {r.estado} · {r.motivo}</li>)}</ol>}
    {historico.hasNextPage && <Button variant="secondary" disabled={historico.isFetching} onClick={() => void historico.fetchNextPage()}>Mais registros</Button>}
    {evidencias.isError && <p role="alert">Evidências indisponíveis.</p>}
    {recuperacao.invalido ? <p role="alert">Tentativa local inválida. Procure suporte.</p> : pendente ? <><p>Há uma tentativa pendente; a resposta pode ter sido perdida.</p><Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button></> : <>
      <label>Evidência <select className="input" value={evidenciaId} disabled={ocupado || evidencias.isFetching || evidencias.isError} onChange={(e) => { setEvidenciaId(e.target.value); setConfirmacao(null); }}><option value="">Selecione</option>{lista.filter((e) => e.os_id === atual?.osId).map((e) => <option key={e.evidencia_id} value={e.evidencia_id}>{e.tipo} · {e.referencia} · {e.descricao}</option>)}</select></label>
      {evidencias.hasNextPage && <Button variant="secondary" disabled={evidencias.isFetching} onClick={() => void evidencias.fetchNextPage()}>Mais evidências</Button>}
      <label>Conclusão <select className="input" value={estado} disabled={ocupado} onChange={(e) => { setEstado(e.target.value as typeof estado); setConfirmacao(null); }}><option value="incerta">Incerta</option><option value="nao_executada_declarada">Não executada declarada</option></select></label>
      <label>Motivo <textarea className="input" maxLength={2000} value={motivo} disabled={ocupado} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      {confirmacao && confirmacao !== fotografia && <p role="alert">Contexto ou evidência mudou. Confira novamente.</p>}
      <label><input type="checkbox" checked={Boolean(fotografia && confirmacao === fotografia)} disabled={ocupado || !fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmo a revisão dos dados e da evidência.</label>
      <Button variant="secondary" disabled={ocupado || !fotografia || confirmacao !== fotografia || !motivo.trim() || atual?.situacao !== "pendente" || atual?.suspensao !== "suspenso" || atual?.interrupcao !== "declarada"} onClick={iniciar}>Registrar reconciliação</Button>
    </>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
