import { Button } from "@sinergica/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
const opcaoSchema = z.object({ os_id: id, numero: z.string(), estado_os: z.string(), os_atualizada_em: z.string().datetime({ offset: true }).nullable(),
  chamado_revision: z.number().int().positive(), escopo_revision: z.number().int().positive(), suspensao_revision: z.number().int().positive().nullable(),
  declaracao_revision: z.number().int().nonnegative(), declaracao_estado: z.enum(["declarada", "revogada"]).nullable() }).strict();
const base = { requestId: id, atorId: id, clienteId: id, composicaoId: id, cicloId: id, parcelaId: id, osId: id, motivo: z.string().trim().min(1).max(2000) };
const pedidoSchema = z.discriminatedUnion("modo", [
  z.object({ ...base, modo: z.literal("atribuir"), chamadoRevision: z.number().int().positive(), escopoRevision: z.number().int().positive(),
    osStatus: z.string(), osAtualizadaEm: z.string().datetime({ offset: true }) }).strict(),
  z.object({ ...base, modo: z.literal("interromper"), escopoRevision: z.number().int().positive(), suspensaoRevision: z.number().int().positive(),
    revision: z.number().int().nonnegative(), estado: z.enum(["declarada", "revogada"]) }).strict(),
]);
type Pedido = z.infer<typeof pedidoSchema>;
const atribuicaoSchema = z.object({ requestId: id, parcelaId: id, osId: id, execucaoComprovada: z.literal(false) }).strict();
const interrupcaoSchema = z.object({ requestId: id, parcelaId: id, osId: id, revision: z.number().int().positive(), estado: z.enum(["declarada", "revogada"]) }).strict();

export function OsCicloPosterior({ userId, clienteId, composicaoId, cicloId, parcelaId, modo }: {
  userId: string; clienteId: string; composicaoId: string; cicloId: string; parcelaId: string; modo: "atribuir" | "interromper";
}) {
  const chave = `sso-os-ciclo-posterior:${userId}:${clienteId}:${cicloId}:${parcelaId}:${modo}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave); if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (pedido.atorId !== userId || pedido.clienteId !== clienteId || pedido.composicaoId !== composicaoId || pedido.cicloId !== cicloId || pedido.parcelaId !== parcelaId || pedido.modo !== modo) throw new Error("Contexto divergente");
      return { pedido, invalido: false };
    } catch { return { pedido: null, invalido: true }; }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [osId, setOsId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  async function conferirAtor(signal?: AbortSignal) { const { data, error } = await supabase.auth.getUser(); if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada"); }
  const consulta = useInfiniteQuery({
    queryKey: ["backlog-os-ciclo", userId, clienteId, cicloId, modo], initialPageParam: null as string | null, gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      await conferirAtor(signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_os_ciclo_posterior", { p_cliente_id: clienteId, p_ciclo_id: cicloId, p_modo: modo, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(opcaoSchema).max(30).parse(data);
      let anterior = pageParam ?? ""; for (const item of pagina) { if (item.os_id <= anterior) throw new Error("Página divergente"); anterior = item.os_id; }
      await conferirAtor(signal); return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.os_id : undefined,
  });
  const recebidos = consulta.data?.pages.flat() ?? [];
  const paginasDivergentes = recebidos.some((item, i) => i > 0 && item.os_id.toLowerCase() <= recebidos[i - 1]!.os_id.toLowerCase());
  const itens = !consulta.isFetching && !consulta.isError && !paginasDivergentes ? recebidos : [];
  const selecionada = itens.find((item) => item.os_id === osId);
  const fotografia = selecionada ? JSON.stringify(selecionada) : null;
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const resposta = pedido.modo === "atribuir"
        ? await supabase.schema("pcm").rpc("sso_atribuir_parcela_ciclo", { p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId,
          p_cliente_id: pedido.clienteId, p_ciclo_id: pedido.cicloId, p_parcela_id: pedido.parcelaId, p_os_id: pedido.osId,
          p_chamado_revision: pedido.chamadoRevision, p_escopo_revision: pedido.escopoRevision, p_os_status: pedido.osStatus,
          p_os_atualizada_em: pedido.osAtualizadaEm, p_motivo: pedido.motivo })
        : await supabase.schema("pcm").rpc("sso_declarar_interrupcao_ciclo", { p_request_id: pedido.requestId, p_ator_esperado: pedido.atorId,
          p_cliente_id: pedido.clienteId, p_ciclo_id: pedido.cicloId, p_parcela_id: pedido.parcelaId, p_os_id: pedido.osId,
          p_escopo_revision: pedido.escopoRevision, p_suspensao_revision: pedido.suspensaoRevision, p_expected_revision: pedido.revision,
          p_estado: pedido.estado, p_motivo: pedido.motivo });
      if (resposta.error) throw resposta.error;
      if (pedido.modo === "atribuir") {
        const r = atribuicaoSchema.parse(resposta.data);
        if (r.requestId !== pedido.requestId || r.parcelaId !== parcelaId || r.osId !== pedido.osId) throw new Error("Recibo divergente");
      } else {
        const r = interrupcaoSchema.parse(resposta.data);
        if (r.requestId !== pedido.requestId || r.parcelaId !== parcelaId || r.osId !== pedido.osId || r.revision !== pedido.revision + 1 || r.estado !== pedido.estado) throw new Error("Recibo divergente");
      }
      await conferirAtor();
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["backlog-os-ciclo", userId, clienteId, cicloId] }),
        cache.invalidateQueries({ queryKey: ["backlog-ciclos-posteriores", userId, clienteId, composicaoId] }),
      ]);
      await conferirAtor(); if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setMotivo("");
      setAviso(pedido.modo === "atribuir" ? "Atribuição registrada; execução não foi comprovada." : "Declaração registrada; parada remota não foi comprovada.");
    } catch { setAviso("Não foi possível confirmar a operação. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (trava.current || pendente || recuperacao.invalido || !selecionada || !fotografia || confirmacao !== fotografia || consulta.isFetching || consulta.isError) return;
    try {
      const comum = { requestId: crypto.randomUUID(), atorId: userId, clienteId, composicaoId, cicloId, parcelaId, osId: selecionada.os_id, motivo };
      const pedido = modo === "atribuir" ? pedidoSchema.parse({ ...comum, modo, chamadoRevision: selecionada.chamado_revision,
        escopoRevision: selecionada.escopo_revision, osStatus: selecionada.estado_os, osAtualizadaEm: selecionada.os_atualizada_em })
        : pedidoSchema.parse({ ...comum, modo, escopoRevision: selecionada.escopo_revision, suspensaoRevision: selecionada.suspensao_revision,
          revision: selecionada.declaracao_revision, estado: selecionada.declaracao_estado === "declarada" ? "revogada" : "declarada" });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido)); setPendente(pedido); void enviar(pedido);
    } catch { setAviso("Não foi possível guardar a tentativa. Confira OS, motivo e sessão."); }
  }
  return <section aria-label={modo === "atribuir" ? "Atribuição de OS ao ciclo" : "Interrupção da parcela do ciclo"} className="mt-2 rounded-md border border-line p-3">
    <h5>{modo === "atribuir" ? "Atribuir OS à parcela" : "Declarar ou revogar interrupção"}</h5>
    <p>O registro não envia tarefa nem comprova execução ou parada remota.</p>
    {consulta.isFetching && <p role="status">Consultando OS…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && paginasDivergentes && <p role="alert">A lista de OS mudou durante a consulta. <button type="button" onClick={() => void consulta.refetch()}>Atualizar lista</button></p>}
    {recuperacao.invalido ? <p role="alert">Tentativa local inválida. Procure suporte.</p> : pendente ? <>
      <p>Há pedido pendente para a OS {pendente.osId}; a resposta pode ter sido perdida.</p><Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesmo pedido</Button>
    </> : <>
      {!consulta.isFetching && !consulta.isError && !paginasDivergentes && consulta.data && itens.length === 0 && <p>Nenhuma OS disponível nesta consulta.</p>}
      <label>OS <select className="input" value={osId} disabled={ocupado || consulta.isFetching || consulta.isError || paginasDivergentes} onChange={(e) => { setOsId(e.target.value); setConfirmacao(null); }}>
        <option value="">Selecione</option>{itens.map((o) => <option key={o.os_id} value={o.os_id}>{o.numero} · {o.estado_os} {modo === "interromper" ? `· declaração ${o.declaracao_estado ?? "não informada"}` : ""}</option>)}
      </select></label>
      {consulta.hasNextPage && <Button variant="secondary" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais OS</Button>}
      <label>Motivo <textarea className="input" maxLength={2000} value={motivo} disabled={ocupado} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} /></label>
      {confirmacao && confirmacao !== fotografia && <p role="alert">A seleção ou revisão mudou. Confira novamente.</p>}
      <label><input type="checkbox" checked={Boolean(fotografia && confirmacao === fotografia)} disabled={ocupado || !fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmo a OS e os dados exibidos.</label>
      <Button variant="secondary" disabled={ocupado || !fotografia || confirmacao !== fotografia || !motivo.trim()} onClick={iniciar}>{modo === "atribuir" ? "Registrar atribuição" : selecionada?.declaracao_estado === "declarada" ? "Revogar declaração" : "Declarar interrupção"}</Button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
