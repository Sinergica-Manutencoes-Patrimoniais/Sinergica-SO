import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().guid();
const itemSchema = z.object({ requestId: uuid, planoId: uuid, rotinaId: uuid, fotografia: z.record(z.string(), z.unknown()),
  modo: z.enum(["calendario", "visita"]), intervalo: z.number().int().min(1).max(10000),
  unidade: z.enum(["dias", "semanas", "meses", "anos"]), dataBase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  antes: z.number().int().min(0).max(10000), depois: z.number().int().min(0).max(10000) }).strict();
const tentativaSchema = z.object({ atorId: uuid, clienteId: uuid, aceiteId: uuid, loteId: uuid,
  etapa: z.enum(["aceite", "criacao"]), itens: z.array(itemSchema).min(1).max(20),
  cancelamento: z.object({ requestId: uuid, motivo: z.string().trim().min(1).max(2000) }).strict().optional() }).strict();
type Item = z.infer<typeof itemSchema>;
type Tentativa = z.infer<typeof tentativaSchema>;
type Props = { userId: string; clienteId: string; planos: { plano_id: string; classificacao: string }[]; disponivel: boolean };

export function LoteRascunhosLegados(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}

function Conteudo({ userId, clienteId, planos, disponivel }: Props) {
  const chave = `sso-lote-rascunhos-legados:${JSON.stringify([userId, clienteId])}`;
  const [itens, setItens] = useState<Item[]>([]);
  const [planoId, setPlanoId] = useState("");
  const [modo, setModo] = useState("");
  const [intervalo, setIntervalo] = useState("");
  const [unidade, setUnidade] = useState("");
  const [dataBase, setDataBase] = useState("");
  const [antes, setAntes] = useState("0");
  const [depois, setDepois] = useState("0");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [confirmouCancelamento, setConfirmouCancelamento] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Tentativa | "invalido" | null>(() => {
    try { const salvo = sessionStorage.getItem(chave); if (!salvo) return null;
      const p = tentativaSchema.parse(JSON.parse(salvo)); return p.atorId === userId && p.clienteId === clienteId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const trava = useRef(false);
  const cache = useQueryClient();
  const selecao = planos.find((p) => p.plano_id === planoId && p.classificacao === "alvo_coerente_migracao_nao_planejada");
  async function conferirSessao(signal?: AbortSignal) {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const foto = useQuery({ queryKey: ["migracao-fotografia-plano", userId, clienteId, planoId], enabled: !!selecao && !pendente,
    gcTime: 0, retry: false, queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_fotografia_plano_legado", {
        p_ator_id: userId, p_cliente_id: clienteId, p_plano_legado_id: planoId,
      }).abortSignal(signal);
      if (error) throw error;
      const r = z.object({ clienteId: uuid, planoLegadoId: uuid, fotografia: z.record(z.string(), z.unknown()),
        rascunhoExistente: z.boolean(), equivalenciaComprovada: z.literal(false) }).strict().parse(data);
      if (r.clienteId !== clienteId || r.planoLegadoId !== planoId || r.fotografia.id !== planoId || r.fotografia.cliente_id !== clienteId) throw new Error("Fotografia divergente.");
      await conferirSessao(signal); return r;
    } });
  const fotografia = JSON.stringify([userId, clienteId, itens]);
  const selecaoAtual = disponivel && itens.every(item => planos.some(plano => plano.plano_id === item.planoId && plano.classificacao === "alvo_coerente_migracao_nao_planejada"));
  useEffect(() => { if (!selecaoAtual) setConfirmacao(null); }, [selecaoAtual]);
  function adicionar() {
    if (pendente || ocupado || !selecao || !foto.data || foto.isFetching || foto.isError || foto.data.rascunhoExistente || itens.length >= 20) return;
    try {
      if (![intervalo, antes, depois].every((v) => /^\d+$/.test(v)) || itens.some((i) => i.planoId === planoId)) throw new Error();
      const item = itemSchema.parse({ requestId: crypto.randomUUID(), planoId, rotinaId: crypto.randomUUID(), fotografia: foto.data.fotografia,
        modo, intervalo: Number(intervalo), unidade, dataBase, antes: Number(antes), depois: Number(depois) });
      setItens((atual) => [...atual, item]); setPlanoId(""); setConfirmacao(null); setAviso("");
    } catch { setAviso("Confira a regra, tolerâncias e seleção; nenhuma informação foi enviada."); }
  }
  async function executar(p: Tentativa, somenteRecibo = false) {
    if (trava.current || (p.cancelamento && !somenteRecibo)) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      let atual = p;
      if (p.etapa === "aceite" && !somenteRecibo) {
        const { data, error } = await supabase.schema("pcm").rpc("sso_aceitar_previa_lote_legado", {
          p_ator_id: userId, p_cliente_id: clienteId, p_request_id: p.aceiteId, p_itens: p.itens, p_confirmado: true,
        });
        if (error || !data || data.requestId !== p.aceiteId || data.clienteId !== clienteId || data.quantidade !== p.itens.length ||
          data.estado !== "aceite_selecao" || data.equivalenciaComprovada !== false || data.migracaoExecutada !== false) throw new Error("Recibo inválido.");
        await conferirSessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
        atual = { ...p, etapa: "criacao" }; sessionStorage.setItem(chave, JSON.stringify(atual)); setPendente(atual);
      }
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(atual)) throw new Error("Tentativa alterada.");
      const { data, error } = somenteRecibo
        ? await supabase.schema("pcm").rpc("sso_recibo_lote_legado", { p_ator_id: userId, p_cliente_id: clienteId, p_lote_id: atual.loteId, p_aceite_id: atual.aceiteId })
        : await supabase.schema("pcm").rpc("sso_criar_lote_legado_aceito", { p_ator_id: userId, p_cliente_id: clienteId, p_request_id: atual.loteId, p_aceite_id: atual.aceiteId });
      if (error || !data || data.requestId !== atual.loteId || data.clienteId !== clienteId || data.quantidade !== atual.itens.length ||
        data.equivalenciaComprovada !== false || data.aprovacaoRealizada !== false || !Array.isArray(data.itens) || data.itens.length !== atual.itens.length) throw new Error("Recibo inválido.");
      const recebidos = new Map<string, Record<string, unknown>>();
      for (const r of data.itens) { if (!r || typeof r !== "object" || typeof r.requestId !== "string" || recebidos.has(r.requestId)) throw new Error("Recibo inválido."); recebidos.set(r.requestId, r); }
      for (const i of atual.itens) { const r = recebidos.get(i.requestId); const links = r?.linkedIds as Record<string, unknown> | undefined;
        if (!r || r.aggregateId !== i.planoId || r.state !== "rascunho" || links?.clienteId !== clienteId || links?.planoLegadoId !== i.planoId || links?.rotinaId !== i.rotinaId) throw new Error("Recibo divergente."); }
      await cache.invalidateQueries({ queryKey: ["migracao-preflight-planos", userId, clienteId], refetchType: "none" });
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(atual)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPendente(null); setItens([]); setConfirmacao(null);
      setAviso(`${atual.itens.length} rascunho(s) registrados. Revise tempo, tipo de tarefa e equivalência antes de aprovar.`);
      void cache.refetchQueries({ queryKey: ["migracao-preflight-planos", userId, clienteId], type: "active" });
    } catch { setAviso(somenteRecibo ? "Recibo indisponível ou divergente. A tentativa pode estar em andamento; procure suporte." : "Resultado não confirmado. Repita a mesma tentativa ou consulte suporte; não inicie outro lote."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function cancelar(p: Tentativa, somenteRecibo = false) {
    if (trava.current || p.etapa !== "criacao" || !p.cancelamento) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      const parametros = {
        p_ator_id: userId, p_cliente_id: clienteId, p_request_id: p.cancelamento.requestId,
        p_aceite_id: p.aceiteId, p_motivo: p.cancelamento.motivo,
      };
      const { data, error } = somenteRecibo
        ? await supabase.schema("pcm").rpc("sso_recibo_cancelamento_aceite_lote", parametros)
        : await supabase.schema("pcm").rpc("sso_cancelar_aceite_lote_legado", parametros);
      if (error || !data || data.requestId !== p.cancelamento.requestId || data.clienteId !== clienteId ||
        data.aceiteId !== p.aceiteId || data.estado !== "cancelado" || data.loteRevertido !== false) throw new Error("Recibo inválido.");
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPendente(null); setItens([]); setConfirmacao(null);
      setMotivoCancelamento(""); setConfirmouCancelamento(false);
      setAviso("Aceite cancelado. Nenhum lote foi revertido ou histórico apagado.");
    } catch { setAviso(somenteRecibo ? "Recibo de cancelamento indisponível. A tentativa permanece guardada; procure suporte." : "Cancelamento não confirmado. Repita a mesma tentativa ou consulte o recibo do lote e suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciarCancelamento(p: Tentativa) {
    if (ocupado || trava.current || p.etapa !== "criacao" || p.cancelamento || !confirmouCancelamento) return;
    try {
      const atualizado = tentativaSchema.parse({ ...p, cancelamento: { requestId: crypto.randomUUID(), motivo: motivoCancelamento } });
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.setItem(chave, JSON.stringify(atualizado)); setPendente(atualizado); void cancelar(atualizado);
    } catch { setAviso("Confira o motivo e a tentativa. Nenhum cancelamento foi enviado."); }
  }
  function iniciar() {
    if (pendente || ocupado || !itens.length || !selecaoAtual || confirmacao !== fotografia) return;
    try {
      const p = tentativaSchema.parse({ atorId: userId, clienteId, aceiteId: crypto.randomUUID(), loteId: crypto.randomUUID(), etapa: "aceite", itens });
      if (sessionStorage.getItem(chave) !== null) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void executar(p);
    } catch { setAviso("Não foi possível guardar a tentativa. Nenhuma solicitação foi enviada."); }
  }
  return <section aria-label="Lote de rascunhos de Planos legados"><h4>Preparar lote de rascunhos</h4>
    <p>Até 20 Planos do mesmo Cliente. Nenhum histórico é migrado, Plano aprovado ou tarefa criada. A tentativa guarda fotografias nesta aba.</p>
    {pendente === "invalido" ? <p role="alert">Tentativa local ilegível. Procure suporte.</p> : pendente ? <>
      <p>Tentativa pendente: etapa {pendente.etapa}, {pendente.itens.length} Plano(s).</p>
      <button type="button" disabled={ocupado || !!pendente.cancelamento} onClick={() => void executar(pendente)}>Repetir mesma tentativa</button>
      {import.meta.env.VITE_SSO_RECIBOS_LOTES_LEGADOS_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void executar(pendente, true)}>Consultar recibo sem repetir</button>}
      {import.meta.env.VITE_SSO_CANCELAR_ACEITE_LOTE_ENABLED === "true" && pendente.etapa === "criacao" && <div>
        <p>Cancelar o aceite impede nova criação, mas não reverte lote que já tenha sido criado.</p>
        {pendente.cancelamento ? <><p>Cancelamento pendente. Motivo: {pendente.cancelamento.motivo}.</p><button type="button" disabled={ocupado} onClick={() => void cancelar(pendente)}>Repetir cancelamento</button>
          {import.meta.env.VITE_SSO_RECIBOS_LOTES_LEGADOS_ENABLED === "true" && <button type="button" disabled={ocupado} onClick={() => void cancelar(pendente, true)}>Consultar recibo do cancelamento</button>}</> : <>
          <label>Motivo <textarea maxLength={2000} value={motivoCancelamento} onChange={(e) => { setMotivoCancelamento(e.target.value); setConfirmouCancelamento(false); }} /></label>
          <label><input type="checkbox" checked={confirmouCancelamento} onChange={(e) => setConfirmouCancelamento(e.target.checked)} /> Entendo que o cancelamento não reverte lote já criado.</label>
          <button type="button" disabled={ocupado || !confirmouCancelamento || !motivoCancelamento.trim()} onClick={() => iniciarCancelamento(pendente)}>Cancelar aceite</button>
        </>}
      </div>}
    </> : <>
      <label>Plano carregado <select value={planoId} onChange={(e) => setPlanoId(e.target.value)}><option value="">Selecione</option>
        {planos.filter((p) => p.classificacao === "alvo_coerente_migracao_nao_planejada" && !itens.some((i) => i.planoId === p.plano_id)).map((p) => <option key={p.plano_id} value={p.plano_id}>{p.plano_id}</option>)}</select></label>
      {foto.isFetching && <p>Consultando fotografia…</p>}{foto.isError && <p role="alert">Fotografia indisponível. <button type="button" onClick={() => void foto.refetch()}>Tentar novamente</button></p>}
      {foto.data && !foto.isFetching && !foto.isError && <div><p>Origem {String(foto.data.fotografia.nome ?? "sem nome")} · {foto.data.rascunhoExistente ? "já possui rascunho" : "ainda sem rascunho"}.</p>
        <p>Sistema {String(foto.data.fotografia.sistema_id ?? "não informado")} · Componente/Equipamento {String(foto.data.fotografia.equipamento_id ?? "não informado")} · questionário {String(foto.data.fotografia.questionario_id ?? "não informado")} · tipo de tarefa {String(foto.data.fotografia.tipo_tarefa_id ?? "não informado")}.</p>
        <p>Regra anterior: {String(foto.data.fotografia.intervalo_n ?? "não informada")} {String(foto.data.fotografia.intervalo_unidade ?? "")} · primeira data {String(foto.data.fotografia.primeira_data ?? "não informada")}.</p></div>}
      <label>Modo <select value={modo} onChange={(e) => setModo(e.target.value)}><option value="">Selecione</option><option value="calendario">Por calendário</option><option value="visita">Por Visita</option></select></label>
      <label>Intervalo <input inputMode="numeric" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} /></label>
      <label>Unidade <select value={unidade} onChange={(e) => setUnidade(e.target.value)}><option value="">Selecione</option><option value="dias">Dias</option><option value="semanas">Semanas</option><option value="meses">Meses</option><option value="anos">Anos</option></select></label>
      <label>Data-base <input type="date" value={dataBase} onChange={(e) => setDataBase(e.target.value)} /></label>
      <label>Dias antes <input inputMode="numeric" value={antes} onChange={(e) => setAntes(e.target.value)} /></label>
      <label>Dias depois <input inputMode="numeric" value={depois} onChange={(e) => setDepois(e.target.value)} /></label>
      <button type="button" disabled={ocupado || !selecao || !foto.data || foto.isFetching || foto.isError || foto.data.rascunhoExistente || itens.length >= 20} onClick={adicionar}>Adicionar Plano</button>
      <ol>{itens.map((i) => <li key={i.planoId}>{String(i.fotografia.nome ?? "Plano")} ({i.planoId}) · {i.modo} · {i.intervalo} {i.unidade} · base {i.dataBase} · tolerância {i.antes}/{i.depois} dias.
        <p>Sistema {String(i.fotografia.sistema_id ?? "não informado")} · Componente/Equipamento {String(i.fotografia.equipamento_id ?? "não informado")} · questionário {String(i.fotografia.questionario_id ?? "não informado")} · tipo de tarefa {String(i.fotografia.tipo_tarefa_id ?? "não informado")}.</p>
        <button type="button" onClick={() => { setItens((atuais) => atuais.filter((a) => a.planoId !== i.planoId)); setConfirmacao(null); }}>Remover</button></li>)}</ol>
      {itens.length > 0 && !selecaoAtual && <p role="alert">Origens não estão disponíveis ou elegíveis nas páginas atuais; reconsulte antes de iniciar. A seleção foi preservada.</p>}
      <label><input type="checkbox" checked={confirmacao === fotografia && selecaoAtual} disabled={!itens.length || ocupado || !selecaoAtual} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Conferi cada origem, regra e tolerância; desejo criar somente rascunhos.</label>
      <button type="button" disabled={!itens.length || ocupado || !selecaoAtual || confirmacao !== fotografia} onClick={iniciar}>Aceitar seleção e criar rascunhos</button>
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
