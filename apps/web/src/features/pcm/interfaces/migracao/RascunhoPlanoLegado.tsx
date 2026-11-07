import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ReverterRascunhoLegado } from "./ReverterRascunhoLegado";

const uuid = z.string().guid();
const fotografia = z.object({ id: uuid, cliente_id: uuid, nome: z.string().min(1), questionario_id: uuid,
  tipo_tarefa_id: uuid, primeira_data: z.string(), intervalo_n: z.number().int().positive(), intervalo_unidade: z.string(),
  sistema_id: uuid.nullable(), equipamento_id: uuid.nullable() }).passthrough();
const consultaSchema = z.object({ clienteId: uuid, planoLegadoId: uuid, fotografia, rascunhoExistente: z.boolean(), equivalenciaComprovada: z.literal(false) }).strict();
const pedidoSchema = z.object({ requestId: uuid, clienteId: uuid, planoId: uuid, rotinaId: uuid, fotografia,
  modo: z.enum(["calendario", "visita"]), intervalo: z.number().int().positive().max(10000),
  unidade: z.enum(["dias", "semanas", "meses", "anos"]), dataBase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  antes: z.number().int().nonnegative().max(10000), depois: z.number().int().nonnegative().max(10000) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;

export function RascunhoPlanoLegado(props: { userId: string; clienteId: string; planoId: string; disponivel?: boolean; elegivel?: boolean }) {
  return <Formulario key={JSON.stringify([props.userId, props.clienteId, props.planoId])} {...props} />;
}

function Formulario({ userId, clienteId, planoId, disponivel = true, elegivel = true }: { userId: string; clienteId: string; planoId: string; disponivel?: boolean; elegivel?: boolean }) {
  const chave = `sso-rascunho-plano-legado:${JSON.stringify([userId, clienteId, planoId])}`;
  const cache = useQueryClient(); const trava = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try { const texto = sessionStorage.getItem(chave); if (!texto) return null;
      const p = pedidoSchema.parse(JSON.parse(texto)); return p.clienteId === clienteId && p.planoId === planoId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [modo, setModo] = useState(""); const [intervalo, setIntervalo] = useState(""); const [unidade, setUnidade] = useState("");
  const [dataBase, setDataBase] = useState(""); const [antes, setAntes] = useState("0"); const [depois, setDepois] = useState("0");
  const [confirmacao, setConfirmacao] = useState<string | null>(null); const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  const consulta = useQuery({ queryKey: ["migracao-fotografia-plano", userId, clienteId, planoId], gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const sessao = await supabase.auth.getUser(); if (sessao.error || sessao.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_fotografia_plano_legado", {
        p_ator_id: userId, p_cliente_id: clienteId, p_plano_legado_id: planoId,
      }).abortSignal(signal);
      if (error) throw error; const resultado = consultaSchema.parse(data);
      if (resultado.clienteId !== clienteId || resultado.planoLegadoId !== planoId || resultado.fotografia.id !== planoId || resultado.fotografia.cliente_id !== clienteId) throw new Error("Fotografia divergente.");
      const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    },
  });
  const dadosConferidos = JSON.stringify([userId, clienteId, planoId, consulta.data?.fotografia ?? null, modo, intervalo, unidade, dataBase, antes, depois]);
  async function enviar(p: Pedido) {
    if (trava.current || !disponivel) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      trava.current = true; setOcupado(true); setAviso("");
      const sessao = await supabase.auth.getUser(); if (sessao.error || sessao.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_criar_rascunho_plano_legado", {
        p_ator_id: userId, p_cliente_id: clienteId, p_request_id: p.requestId, p_plano_legado_id: p.planoId, p_rotina_id: p.rotinaId,
        p_fotografia: p.fotografia, p_modo: p.modo, p_intervalo: p.intervalo, p_unidade: p.unidade,
        p_data_base: p.dataBase, p_tolerancia_antes: p.antes, p_tolerancia_depois: p.depois,
      });
      if (error) throw error;
      const recibo = z.object({ requestId: uuid, aggregateId: uuid, revision: z.number().int().positive(), state: z.literal("rascunho"), created: z.literal(true),
        linkedIds: z.object({ clienteId: uuid, planoLegadoId: uuid, versaoId: uuid, rotinaId: uuid }).strict(), warnings: z.array(z.string()) }).strict().parse(data);
      if (recibo.requestId !== p.requestId || recibo.aggregateId !== planoId || recibo.linkedIds.planoLegadoId !== planoId || recibo.linkedIds.clienteId !== clienteId || recibo.linkedIds.rotinaId !== p.rotinaId) throw new Error("Recibo divergente.");
      const depoisSessao = await supabase.auth.getUser(); if (depoisSessao.error || depoisSessao.data.user?.id !== userId) throw new Error("Sessão alterada.");
      await Promise.all([cache.invalidateQueries({ queryKey: ["migracao-fotografia-plano", userId, clienteId, planoId] }), cache.invalidateQueries({ queryKey: ["migracao-preflight-planos", userId, clienteId] })]);
      const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmacao(null); setAviso("Rascunho criado. Revise tipo de tarefa, tempo e equivalência antes de qualquer aprovação.");
    } catch { setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte; não crie outro pedido."); }
    finally { trava.current = false; setOcupado(false); }
  }
  function iniciar() {
    if (!disponivel || !elegivel || pendente || ocupado || confirmacao !== dadosConferidos || !consulta.data || consulta.isFetching || consulta.isError || consulta.data.rascunhoExistente) return;
    try {
      if (!/^\d+$/.test(intervalo) || !/^\d+$/.test(antes) || !/^\d+$/.test(depois)) throw new Error();
      const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), clienteId, planoId, rotinaId: crypto.randomUUID(), fotografia: consulta.data.fotografia,
        modo, intervalo: Number(intervalo), unidade, dataBase, antes: Number(antes), depois: Number(depois) });
      if (sessionStorage.getItem(chave) !== null) throw new Error(); sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
    } catch { setAviso("Confira os campos ou a tentativa pendente. Nada foi enviado."); }
  }
  return <section aria-label="Criar rascunho de Plano legado"><h4>Preparar rascunho</h4>
    <p>A origem e ocorrências antigas não são alteradas. Não aprova o Plano nem comprova equivalência; o tipo de tarefa exige mapeamento.</p>
    {!disponivel && <p role="alert">Plano não confirmado na consulta atual. Rascunho preservado nesta tela; aguarde a reconsulta antes de enviar.</p>}
    {disponivel && !elegivel && !pendente && <p role="alert">A classificação do Plano mudou. Nova criação está bloqueada; confira o inventário.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa ilegível. Consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <><p>Tentativa pendente para o Plano {pendente.planoId}; modo {pendente.modo}, intervalo {pendente.intervalo} {pendente.unidade}, data-base {pendente.dataBase}.</p>
      <button type="button" disabled={ocupado || !disponivel} onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button></> : !pendente && <>
      {consulta.isFetching && <output>Consultando fotografia…</output>}
      {consulta.isError && <p role="alert">Fotografia indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && consulta.data && <>
        <p>{consulta.data.fotografia.nome} · questionário {consulta.data.fotografia.questionario_id} · tipo de tarefa {consulta.data.fotografia.tipo_tarefa_id} · regra anterior {consulta.data.fotografia.intervalo_n} {consulta.data.fotografia.intervalo_unidade}, base {consulta.data.fotografia.primeira_data}.</p>
        {consulta.data.rascunhoExistente ? <><p>Já existe Plano com esse identificador; requer reconciliação.</p>
          {import.meta.env.VITE_SSO_REVERSAO_RASCUNHO_LEGADO_ENABLED === "true" && <ReverterRascunhoLegado userId={userId} clienteId={clienteId} planoId={planoId} />}</> : <form onSubmit={(e) => { e.preventDefault(); iniciar(); }}>
          <label>Modo <select required value={modo} onChange={(e) => { setModo(e.target.value); setConfirmacao(null); }}><option value="">Escolher</option><option value="calendario">Por calendário</option><option value="visita">Por Visita</option></select></label>
          <label>Intervalo <input required inputMode="numeric" value={intervalo} onChange={(e) => { setIntervalo(e.target.value); setConfirmacao(null); }} /></label>
          <label>Unidade <select required value={unidade} onChange={(e) => { setUnidade(e.target.value); setConfirmacao(null); }}><option value="">Escolher</option><option value="dias">Dias</option><option value="semanas">Semanas</option><option value="meses">Meses</option><option value="anos">Anos</option></select></label>
          <label>Data-base <input required type="date" value={dataBase} onChange={(e) => { setDataBase(e.target.value); setConfirmacao(null); }} /></label>
          <label>Dias antes <input required inputMode="numeric" value={antes} onChange={(e) => { setAntes(e.target.value); setConfirmacao(null); }} /></label>
          <label>Dias depois <input required inputMode="numeric" value={depois} onChange={(e) => { setDepois(e.target.value); setConfirmacao(null); }} /></label>
          <label><input type="checkbox" checked={confirmacao === dadosConferidos} onChange={(e) => setConfirmacao(e.target.checked ? dadosConferidos : null)} /> Conferi a origem e escolhi a regra e tolerâncias.</label>
          <button type="submit" disabled={confirmacao !== dadosConferidos || ocupado || !disponivel || !elegivel}>Criar rascunho</button>
        </form>}
      </>}
    </>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
