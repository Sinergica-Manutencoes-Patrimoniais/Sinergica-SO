// os-from-task.ts — E01-S34. Cria `pcm.ordens_servico` a partir de uma tarefa do Auvo que ainda
// não tem OS local (`auvo_task_id` desconhecido). Compartilhado por `pcm-auvo-webhook` (tempo
// real) e `pcm-auvo-tasks-import` (backfill/reconciliação) — nenhum dos dois duplica esta lógica.
//
// `client_id` é NOT NULL em `pcm.ordens_servico` (migration 0001): sem cliente já sincronizado no
// PCM (`pcm.clientes.auvo_id`), a tarefa é pulada (devolve `null`, nunca lança) — o import de
// reconciliação a pega depois, quando o cliente já estiver sincronizado.

import type { UntypedSupabaseClient } from "../supabase.ts";

export type OsStatus = "solicitacao" | "em_execucao" | "finalizado" | "cancelado";

export interface CriarOsDaTarefaInput {
  taskId: number;
  titulo: string;
  customerId: number;
  status: OsStatus;
  /** E01-S38: dado rico da tarefa Auvo (técnico, data agendada, check-in/check-out, detalhes) —
   * opcional pra não quebrar chamadores existentes; ausente = todas as colunas novas ficam null. */
  tecnicoAuvoUserId?: number | null;
  dataAgendada?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  detalhes?: Record<string, unknown> | null;
}

export interface OsCriada {
  id: string;
  status: OsStatus;
}

/** Resolve `pcm.clientes.id` a partir do `customerId` (auvo_id) da tarefa. `null` = cliente ainda
 * não sincronizado no PCM — não é erro, é um estado esperado (AC-4). */
export async function resolverClienteIdPorAuvoId(
  db: UntypedSupabaseClient,
  customerId: number,
): Promise<string | null> {
  const { data, error } = await db
    .schema("pcm")
    .from("clientes")
    .select("id")
    .eq("auvo_id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/** Mesma resolução acima, em lote — 1 query pra N customerIds em vez de N queries. Usado pelo
 * backfill (`pcm-auvo-tasks-import`), que processa muitas tarefas de uma vez; o webhook (evento
 * único) segue usando `resolverClienteIdPorAuvoId`. */
export async function resolverClienteIdsPorAuvoIds(
  db: UntypedSupabaseClient,
  customerIds: number[],
): Promise<Map<number, string>> {
  const unicos = [...new Set(customerIds)];
  const mapa = new Map<number, string>();
  if (unicos.length === 0) return mapa;
  const { data, error } = await db
    .schema("pcm")
    .from("clientes")
    .select("id,auvo_id")
    .in("auvo_id", unicos)
    .is("deleted_at", null);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.auvo_id != null) mapa.set(row.auvo_id as number, row.id as string);
  }
  return mapa;
}

/** Resolve `pcm.funcionarios.id` a partir do `auvoUserId` (técnico responsável da tarefa). `null`
 * = técnico ainda não sincronizado no PCM — não bloqueia a criação da OS (mesma tolerância de
 * `resolverClienteIdPorAuvoId`, mas aqui é opcional: OS nasce sem técnico resolvido). */
export async function resolverFuncionarioIdPorAuvoId(
  db: UntypedSupabaseClient,
  auvoUserId: number,
): Promise<string | null> {
  const { data, error } = await db
    .schema("pcm")
    .from("funcionarios")
    .select("id")
    .eq("auvo_user_id", auvoUserId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/** Mesma resolução acima, em lote — 1 query pra N auvoUserIds. Usado pelo backfill. */
export async function resolverFuncionarioIdsPorAuvoIds(
  db: UntypedSupabaseClient,
  auvoUserIds: number[],
): Promise<Map<number, string>> {
  const unicos = [...new Set(auvoUserIds)];
  const mapa = new Map<number, string>();
  if (unicos.length === 0) return mapa;
  const { data, error } = await db
    .schema("pcm")
    .from("funcionarios")
    .select("id,auvo_user_id")
    .in("auvo_user_id", unicos)
    .is("deleted_at", null);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.auvo_user_id != null) mapa.set(row.auvo_user_id as number, row.id as string);
  }
  return mapa;
}

export interface ChamadoAutomatico {
  id: string;
  numero: string;
}

/** E01-S99/ADR-0014: toda OS que nasce de uma tarefa Auvo sem Chamado de origem (técnico criou a
 * tarefa direto no app Auvo, sem passar pelo fluxo de Chamado do PCM) ganha um Chamado automático
 * (`origem="auvo_sync"`) — mantém o `CH-XXXX` como identificador único de ponta a ponta, mesmo
 * quando o gatilho é o Auvo. Substitui a antiga `proximoNumeroOs` (E01-S88, prefixo "OS-"). */
export async function criarChamadoAutomatico(
  db: UntypedSupabaseClient,
  input: { clienteId: string; titulo: string; systemUserId: string },
): Promise<ChamadoAutomatico> {
  const { data: numero, error: numeroError } = await db
    .schema("pcm")
    .rpc("fn_proximo_numero_chamado");
  if (numeroError) throw numeroError;
  const { data, error } = await db
    .schema("pcm")
    .from("chamados")
    .insert({
      numero,
      cliente_id: input.clienteId,
      titulo: input.titulo,
      origem: "auvo_sync",
      created_by: input.systemUserId,
      updated_by: input.systemUserId,
    })
    .select("id,numero")
    .single();
  if (error) throw error;
  await db
    .schema("pcm")
    .from("chamados_eventos")
    .insert({ chamado_id: data.id, tipo: "criado", metadata: { numero, auto: true } });
  return { id: data.id as string, numero: data.numero as string };
}

/** Fecha o ciclo do Chamado criado por `criarChamadoAutomatico`/em lote — mesma transição que o
 * app web faz em `marcarStatusComOs` no fluxo "Gerar OS a partir do Chamado". */
export async function marcarChamadoAutomaticoComOs(
  db: UntypedSupabaseClient,
  chamadoId: string,
  ordemServicoId: string,
): Promise<void> {
  const { error } = await db
    .schema("pcm")
    .from("chamados")
    .update({
      status: "convertido_os",
      ordem_servico_id: ordemServicoId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chamadoId);
  if (error) throw error;
  await db
    .schema("pcm")
    .from("chamados_eventos")
    .insert({ chamado_id: chamadoId, tipo: "os_gerada", metadata: { ordemServicoId } });
}

/** Reserva `quantidade` números de Chamado atomicamente numa chamada só (RPC
 * `pcm.fn_proximos_numeros_chamado`) — usado pelo import em lote de `pcm-auvo-tasks-import`, que
 * precisa de N números sem N round-trips. Substitui a antiga `proximosNumerosOs` (E01-S88). */
export async function proximosNumerosChamado(
  db: UntypedSupabaseClient,
  quantidade: number,
): Promise<string[]> {
  if (quantidade <= 0) return [];
  const { data, error } = await db
    .schema("pcm")
    .rpc("fn_proximos_numeros_chamado", { p_quantidade: quantidade });
  if (error) throw error;
  return (data ?? []) as string[];
}

/** Mesmo padrão de `pcm-auvo-customers-import` (`obterUsuarioSistema`): primeiro
 * superadmin/supervisor ativo, usado como `created_by` para registros que o próprio Auvo origina
 * (não têm um usuário PCM real por trás). */
export async function obterUsuarioSistema(db: UntypedSupabaseClient): Promise<string> {
  const { data, error } = await db
    .schema("config")
    .from("usuarios")
    .select("user_id,papel,created_at")
    .eq("ativo", true)
    .in("papel", ["superadmin", "supervisor"])
    .order("papel", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.user_id) {
    throw new Error("Nenhum usuário ativo superadmin/supervisor encontrado para autoria da OS via Auvo");
  }
  return data.user_id as string;
}

export interface OsRowParams {
  clienteId: string;
  /** E01-S99/ADR-0014: Chamado de origem — o `numero` da OS (CH-XXXX) vem sempre daqui, nunca é
   * enviado explicitamente (trigger `fn_ordens_servico_sync_numero_chamado`, migration 0151). */
  chamadoId: string;
  systemUserId: string;
  /** E01-S38: null quando o técnico ainda não está sincronizado no PCM (não bloqueia a OS). */
  tecnicoFuncionarioId?: string | null;
}

/** Monta a linha de `pcm.ordens_servico` a partir de uma tarefa Auvo — pura, sem I/O. Compartilhada
 * entre `criarOsDaTarefa` (webhook, 1 tarefa por vez) e o insert em lote do backfill
 * (`pcm-auvo-tasks-import`), pra não duplicar o formato da linha entre os dois caminhos. */
export function montarLinhaOs(
  input: CriarOsDaTarefaInput,
  params: OsRowParams,
): Record<string, unknown> {
  return {
    client_id: params.clienteId,
    chamado_id: params.chamadoId,
    titulo: input.titulo,
    categoria: "corretiva", // AUTO-DECISION: Auvo não tem campo equivalente a categoria do PCM — ver design.md
    status: input.status,
    origem: "auvo",
    origem_ref_id: String(input.taskId),
    auvo_task_id: input.taskId,
    auvo_sync_status: "synced",
    auvo_synced_at: new Date().toISOString(),
    created_by: params.systemUserId,
    tecnico_auvo_user_id: input.tecnicoAuvoUserId ?? null,
    tecnico_funcionario_id: params.tecnicoFuncionarioId ?? null,
    data_agendada: input.dataAgendada ?? null,
    check_in_at: input.checkInAt ?? null,
    check_out_at: input.checkOutAt ?? null,
    auvo_detalhes: input.detalhes ?? null,
  };
}

/** Cria a OS a partir de uma tarefa Auvo sem `auvo_task_id` local correspondente. Devolve `null`
 * (sem lançar) quando o cliente ainda não está sincronizado — AC-4: nunca quebra o chamador. */
export async function criarOsDaTarefa(
  db: UntypedSupabaseClient,
  input: CriarOsDaTarefaInput,
): Promise<OsCriada | null> {
  const clienteId = await resolverClienteIdPorAuvoId(db, input.customerId);
  if (!clienteId) return null;

  const [systemUserId, tecnicoFuncionarioId] = await Promise.all([
    obterUsuarioSistema(db),
    input.tecnicoAuvoUserId != null
      ? resolverFuncionarioIdPorAuvoId(db, input.tecnicoAuvoUserId)
      : Promise.resolve(null),
  ]);

  const chamado = await criarChamadoAutomatico(db, {
    clienteId,
    titulo: input.titulo,
    systemUserId,
  });

  const { data, error } = await db
    .schema("pcm")
    .from("ordens_servico")
    .insert(montarLinhaOs(input, { clienteId, chamadoId: chamado.id, systemUserId, tecnicoFuncionarioId }))
    .select("id")
    .single();
  if (error) throw error;

  await marcarChamadoAutomaticoComOs(db, chamado.id, data.id as string);

  return { id: data.id as string, status: input.status };
}
