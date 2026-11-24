import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type {
  ConsultaOperacao,
  CursorOperacao,
  ItemOperacaoResumo,
  OperacaoDetalhe,
  OperacaoGateway,
  PaginaOperacao,
} from "../application/operacao-gateway";
import type { ItemCampoAConciliar } from "../domain/campo-a-conciliar";
import type { ExcecaoAuvo } from "../domain/excecoes-auvo";

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
  ocorrencia_preventiva_id: string | null;
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
  "item_id,item_tipo,ordem_servico_id,chamado_id,cliente_id,cliente_nome,numero,titulo,categoria,origem,status,prioridade,gravidade,urgencia,tendencia,dor_cliente,score_pcm,origem_inspecao_item_id,auvo_task_id,auvo_sync_status,auvo_sync_error,created_at,tecnico_funcionario_id,tecnico_nome,data_agendada,check_in_at,check_out_at,tipo_os,pmoc_schedule_id,orientacao,ocorrencia_preventiva_id" as const;

const PREFIXO_CHAMADO = "chamado-aberto:";

/** Resumo pontual limitado por Cliente; RLS da view permanece a autoridade. */
export async function obterResumoOsDoCliente(
  clienteId: string,
  osId: string,
  signal?: AbortSignal,
): Promise<ItemOperacaoResumo | null> {
  if (!z.string().guid().safeParse(clienteId).success || !z.string().guid().safeParse(osId).success)
    throw new Error("Contexto inválido.");
  let consulta = supabase
    .schema("pcm")
    .from("operacao_itens")
    .select(COLUNAS_RESUMO)
    .eq("item_tipo", "ordem_servico")
    .eq("cliente_id", clienteId)
    .eq("ordem_servico_id", osId);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as OperacaoRow;
  if (
    row.cliente_id !== clienteId ||
    row.ordem_servico_id !== osId ||
    row.item_id !== osId ||
    row.item_tipo !== "ordem_servico"
  )
    throw new Error("Resumo de OS incompatível com o contexto.");
  return mapearResumo(row);
}

/** E01-S192 AC-9: resolve lazy o nome do Plano legado que originou a ocorrência preventiva da OS
 * — só chamada quando o drawer abre uma OS com `ocorrenciaPreventivaId` preenchido. */
export async function resolverPlanoOrigemOs(
  clienteId: string,
  ocorrenciaPreventivaId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (
    !z.string().guid().safeParse(clienteId).success ||
    !z.string().guid().safeParse(ocorrenciaPreventivaId).success
  )
    throw new Error("Contexto inválido.");
  let chamada = supabase.schema("pcm").rpc("sso_resolver_plano_origem_os", {
    p_cliente_id: clienteId,
    p_ocorrencia_preventiva_id: ocorrenciaPreventivaId,
  });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  return data as string | null;
}

/** E01-S199 — fila "Campo a conciliar" do Kanban: OS que chegou do Auvo sem ID de Chamado e que
 * o PCM ainda não conciliou (migration 1866). A RPC já recusa com erro nomeado quando o gate
 * `pcm.sso_consulta_estado_campo_gate` está fechado ou falta a capacidade `execucao.validar` —
 * a página distingue esses dois casos de "fila vazia", nunca mostra tela em branco. */
export async function listarCampoAConciliar(
  atorId: string,
  clienteId: string,
  signal?: AbortSignal,
): Promise<ItemCampoAConciliar[]> {
  if (
    !z.string().guid().safeParse(atorId).success ||
    !z.string().guid().safeParse(clienteId).success
  )
    throw new Error("Contexto inválido.");
  let chamada = supabase.schema("pcm").rpc("sso_listar_campo_a_conciliar", {
    p_ator_id: atorId,
    p_cliente_id: clienteId,
    p_limite: 50,
  });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  const linhas = linhaCampoAConciliarSchema.array().safeParse(data ?? []);
  if (!linhas.success) throw new Error("Fila de conciliação em formato inesperado.");
  return linhas.data.map((linha) => ({
    osId: linha.os_id,
    chamadoId: linha.chamado_id,
    osNumero: linha.os_numero,
    chamadoNumero: linha.chamado_numero,
    titulo: linha.titulo,
    motivo: linha.motivo,
    taskId: linha.task_id,
    statusOs: linha.status_os,
    criadoEm: linha.criado_em,
  }));
}

const linhaCampoAConciliarSchema = z
  .object({
    os_id: z.string().guid(),
    chamado_id: z.string().guid(),
    os_numero: z.string(),
    chamado_numero: z.string(),
    titulo: z.string(),
    motivo: z.string(),
    task_id: z.number().int().nullable(),
    status_os: z.string(),
    criado_em: z.string(),
  })
  .strict();

/** E01-S201 — monitor consolidado de exceções do Auvo T−24 (migration 1867). Devolve as três
 * famílias (falha de envio, Visita não confirmada, tarefa órfã) numa chamada só. A RPC recusa
 * com erro NOMEADO quando o gate `pcm.sso_consulta_estado_campo_gate` está fechado
 * (`consulta_desabilitada`) ou falta a capacidade `execucao.validar` (`sem_acesso`) — a página
 * dá uma frase diferente a cada caso; nenhum deles pode parecer "nenhuma exceção". */
export async function listarExcecoesAuvoT24(
  atorId: string,
  clienteId: string,
  signal?: AbortSignal,
): Promise<ExcecaoAuvo[]> {
  if (
    !z.string().guid().safeParse(atorId).success ||
    !z.string().guid().safeParse(clienteId).success
  )
    throw new Error("Contexto inválido.");
  let chamada = supabase.schema("pcm").rpc("sso_listar_excecoes_auvo_t24", {
    p_ator_id: atorId,
    p_cliente_id: clienteId,
    p_limite: 50,
  });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  const linhas = linhaExcecaoAuvoSchema.array().safeParse(data ?? []);
  if (!linhas.success) throw new Error("Monitor de exceções em formato inesperado.");
  return linhas.data.map((linha) => ({
    tipo: linha.tipo,
    clienteId: linha.cliente_id,
    clienteNome: linha.cliente_nome,
    visitaId: linha.visita_id,
    visitaInicioEm: linha.visita_inicio_em,
    osId: linha.os_id,
    osNumero: linha.os_numero,
    taskId: linha.task_id,
    tentativas: linha.tentativas,
    ultimoErro: linha.ultimo_erro,
    ocorridoEm: linha.ocorrido_em,
  }));
}

const linhaExcecaoAuvoSchema = z
  .object({
    tipo: z.enum(["falha_envio", "visita_nao_confirmada", "tarefa_orfa"]),
    cliente_id: z.string().guid(),
    cliente_nome: z.string(),
    visita_id: z.string().guid().nullable(),
    visita_inicio_em: z.string().nullable(),
    os_id: z.string().guid(),
    os_numero: z.string(),
    task_id: z.number().int().nullable(),
    tentativas: z.number().int(),
    ultimo_erro: z.string(),
    ocorrido_em: z.string(),
  })
  .strict();

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
    ocorrenciaPreventivaId: row.ocorrencia_preventiva_id,
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
      .select("descricao,local,solicitante,origem,foto_urls")
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
      fotoUrls: (data.foto_urls as string[] | null) ?? [],
    };
  }

  let query = supabase
    .schema("pcm")
    .from("ordens_servico")
    .select("descricao,observacao,auvo_detalhes,local_descricao,solicitante,origem,foto_urls")
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
    fotoUrls: (data.foto_urls as string[] | null) ?? [],
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
