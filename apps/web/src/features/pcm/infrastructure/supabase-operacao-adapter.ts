import { supabase } from "../../../lib/supabase-client";
import type {
  ConsultaOperacao,
  CursorOperacao,
  ItemOperacaoResumo,
  OperacaoDetalhe,
  OperacaoGateway,
  PaginaOperacao,
} from "../application/operacao-gateway";

interface OperacaoRow {
  item_id: string;
  item_tipo: "ordem_servico" | "chamado_aberto";
  ordem_servico_id: string | null;
  chamado_id: string | null;
  cliente_id: string;
  cliente_nome: string;
  numero: string;
  titulo: string;
  categoria: string;
  origem: string;
  status: string;
  prioridade: string;
  gravidade: number | null;
  urgencia: number | null;
  tendencia: number | null;
  dor_cliente: number | null;
  score_pcm: number;
  origem_inspecao_item_id: string | null;
  auvo_task_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  created_at: string;
  tecnico_funcionario_id: string | null;
  tecnico_nome: string | null;
  data_agendada: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  tipo_os: string | null;
  pmoc_schedule_id: string | null;
  orientacao: string | null;
}

interface KpiRow {
  total: number | string;
  abertas: number | string;
  em_planejamento: number | string;
  em_execucao: number | string;
  finalizadas: number | string;
  criticas: number | string;
}

const COLUNAS_RESUMO =
  "item_id,item_tipo,ordem_servico_id,chamado_id,cliente_id,cliente_nome,numero,titulo,categoria,origem,status,prioridade,gravidade,urgencia,tendencia,dor_cliente,score_pcm,origem_inspecao_item_id,auvo_task_id,auvo_sync_status,auvo_sync_error,created_at,tecnico_funcionario_id,tecnico_nome,data_agendada,check_in_at,check_out_at,tipo_os,pmoc_schedule_id,orientacao" as const;

const PREFIXO_CHAMADO = "chamado-aberto:";

function mapearResumo(row: OperacaoRow): ItemOperacaoResumo {
  return {
    id: row.item_id,
    tipo: row.item_tipo,
    ordemServicoId: row.ordem_servico_id,
    chamadoId: row.chamado_id,
    clienteId: row.cliente_id,
    clienteNome: row.cliente_nome,
    numero: row.numero,
    titulo: row.titulo,
    categoria: row.categoria,
    origem: row.origem,
    status: row.status,
    prioridade: row.prioridade,
    gravidade: row.gravidade,
    urgencia: row.urgencia,
    tendencia: row.tendencia,
    dorCliente: row.dor_cliente,
    scorePcm: row.score_pcm,
    origemInspecaoItemId: row.origem_inspecao_item_id,
    auvoTaskId: row.auvo_task_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    createdAt: row.created_at,
    tecnicoFuncionarioId: row.tecnico_funcionario_id,
    tecnicoNome: row.tecnico_nome,
    dataAgendada: row.data_agendada,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    tipoOs: row.tipo_os,
    pmocScheduleId: row.pmoc_schedule_id,
    orientacao: row.orientacao,
  };
}

function literalPostgrest(valor: string): string {
  return `"${valor.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function buscaSegura(valor: string): string {
  return valor
    .trim()
    .replace(/[,%().:*"\\]/g, " ")
    .replace(/\s+/g, " ");
}

function aplicarCursor<T extends { or: (filtro: string) => T }>(
  query: T,
  cursor: CursorOperacao | null | undefined,
): T {
  if (!cursor) return query;
  if (cursor.ordem === "recentes") {
    const data = literalPostgrest(cursor.createdAt);
    const id = literalPostgrest(cursor.id);
    return query.or(`created_at.lt.${data},and(created_at.eq.${data},item_id.gt.${id})`);
  }
  if (cursor.ordem === "gutd") {
    const data = literalPostgrest(cursor.createdAt);
    const id = literalPostgrest(cursor.id);
    return query.or(
      `score_pcm.lt.${cursor.score},and(score_pcm.eq.${cursor.score},created_at.lt.${data}),and(score_pcm.eq.${cursor.score},created_at.eq.${data},item_id.gt.${id})`,
    );
  }
  const data = literalPostgrest(cursor.dataAgendada);
  const id = literalPostgrest(cursor.id);
  return query.or(`data_agendada.gt.${data},and(data_agendada.eq.${data},item_id.gt.${id})`);
}

function proximoCursor(
  input: ConsultaOperacao,
  row: OperacaoRow | undefined,
): CursorOperacao | null {
  if (!row) return null;
  if (input.ordem === "recentes") {
    return { ordem: "recentes", createdAt: row.created_at, id: row.item_id };
  }
  if (input.ordem === "gutd") {
    return { ordem: "gutd", score: row.score_pcm, createdAt: row.created_at, id: row.item_id };
  }
  if (!row.data_agendada) return null;
  return { ordem: "agenda", dataAgendada: row.data_agendada, id: row.item_id };
}

async function listarPagina(
  input: ConsultaOperacao,
  signal?: AbortSignal,
): Promise<PaginaOperacao> {
  let query = supabase
    .schema("pcm")
    .from("operacao_itens")
    .select(COLUNAS_RESUMO, { count: "exact" });

  if (!input.status || input.status === "ativos") {
    query = query.not("status", "in", "(finalizado,cancelado)");
  } else if (input.status !== "todos") {
    query = query.eq("status", input.status);
  }
  if (input.clienteId) query = query.eq("cliente_id", input.clienteId);
  if (input.tecnicoFuncionarioId) {
    query = query.eq("tecnico_funcionario_id", input.tecnicoFuncionarioId);
  }
  if (input.categoria) query = query.eq("categoria", input.categoria);

  const termo = input.busca ? buscaSegura(input.busca) : "";
  if (termo) {
    query = query.or(
      `numero.ilike.*${termo}*,titulo.ilike.*${termo}*,cliente_nome.ilike.*${termo}*`,
    );
  }

  const campoData = input.ordem === "agenda" ? "data_agendada" : "created_at";
  if (input.ordem === "agenda") query = query.not("data_agendada", "is", null);
  if (input.dataInicio) query = query.gte(campoData, input.dataInicio);
  if (input.dataFim) query = query.lte(campoData, `${input.dataFim}T23:59:59.999`);

  query = aplicarCursor(query, input.cursor);
  if (input.ordem === "gutd") {
    query = query
      .order("score_pcm", { ascending: false })
      .order("created_at", { ascending: false })
      .order("item_id", { ascending: true });
  } else if (input.ordem === "agenda") {
    query = query.order("data_agendada", { ascending: true }).order("item_id", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false }).order("item_id", { ascending: true });
  }

  const requisicao = query.limit(input.limite + 1);
  const { data, error, count } = await (signal ? requisicao.abortSignal(signal) : requisicao);
  if (error) throw error;
  const rows = (data ?? []) as OperacaoRow[];
  const temProxima = rows.length > input.limite;
  const pagina = temProxima ? rows.slice(0, input.limite) : rows;
  return {
    itens: pagina.map(mapearResumo),
    proximoCursor: temProxima ? proximoCursor(input, pagina.at(-1)) : null,
    total: count ?? pagina.length,
  };
}

async function obterDetalhe(itemId: string, signal?: AbortSignal): Promise<OperacaoDetalhe> {
  if (itemId.startsWith(PREFIXO_CHAMADO)) {
    let query = supabase
      .schema("pcm")
      .from("chamados")
      .select("descricao,local,solicitante,origem")
      .eq("id", itemId.slice(PREFIXO_CHAMADO.length))
      .is("deleted_at", null);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.single();
    if (error) throw error;
    return {
      descricao: data.descricao,
      observacao: null,
      detalhes: null,
      localDescricao: data.local,
      solicitante: data.solicitante,
      origem: data.origem,
    };
  }

  let query = supabase
    .schema("pcm")
    .from("ordens_servico")
    .select("descricao,observacao,auvo_detalhes,local_descricao,solicitante,origem")
    .eq("id", itemId)
    .is("deleted_at", null);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.single();
  if (error) throw error;
  return {
    descricao: data.descricao,
    observacao: data.observacao,
    detalhes: data.auvo_detalhes as Record<string, unknown> | null,
    localDescricao: data.local_descricao,
    solicitante: data.solicitante,
    origem: data.origem,
  };
}

export const supabaseOperacaoAdapter: OperacaoGateway = {
  listarPagina,

  async contarKpis(input, signal) {
    let query = supabase.schema("pcm").rpc("fn_kpis_operacao", {
      p_busca: input.busca?.trim() || null,
      p_cliente_id: input.clienteId ?? null,
      p_tecnico_funcionario_id: input.tecnicoFuncionarioId ?? null,
      p_categoria: input.categoria ?? null,
      p_data_inicio: input.dataInicio ?? null,
      p_data_fim: input.dataFim ?? null,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const row = (data as KpiRow[] | null)?.[0];
    return {
      total: Number(row?.total ?? 0),
      abertas: Number(row?.abertas ?? 0),
      emPlanejamento: Number(row?.em_planejamento ?? 0),
      emExecucao: Number(row?.em_execucao ?? 0),
      finalizadas: Number(row?.finalizadas ?? 0),
      criticas: Number(row?.criticas ?? 0),
    };
  },

  obterDetalhe,

  async alterarStatusLote(ids, status) {
    const idsOs = ids.filter((id) => !id.startsWith(PREFIXO_CHAMADO));
    if (idsOs.length === 0) return [];
    const { data, error } = await supabase.schema("pcm").rpc("fn_operacao_alterar_status_lote", {
      p_ids: idsOs,
      p_status: status,
    });
    if (error) throw error;
    return (data ?? []).map((row: { id: string; sucesso: boolean; erro: string | null }) => ({
      id: row.id,
      sucesso: row.sucesso,
      erro: row.erro,
    }));
  },
};
