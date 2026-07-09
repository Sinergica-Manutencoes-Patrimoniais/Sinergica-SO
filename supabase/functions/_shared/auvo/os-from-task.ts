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

export async function contarOsExistentes(db: UntypedSupabaseClient): Promise<number> {
  const { count, error } = await db
    .schema("pcm")
    .from("ordens_servico")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export function formatarNumeroOs(sequencial: number): string {
  return `CH-${String(sequencial).padStart(3, "0")}`;
}

/** Mesma lógica de `pcm-ze-agent` (`proximoNumeroChamado`) — `count()` tem race condition
 * conhecida sob concorrência real, mesma dívida já documentada e aceita nesse padrão (E01-S02). */
export async function proximoNumeroOs(db: UntypedSupabaseClient): Promise<string> {
  return formatarNumeroOs((await contarOsExistentes(db)) + 1);
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
  numero: string;
  systemUserId: string;
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
    numero: params.numero,
    titulo: input.titulo,
    categoria: "corretiva", // AUTO-DECISION: Auvo não tem campo equivalente a categoria do PCM — ver design.md
    status: input.status,
    origem: "auvo",
    origem_ref_id: String(input.taskId),
    auvo_task_id: input.taskId,
    auvo_sync_status: "synced",
    auvo_synced_at: new Date().toISOString(),
    created_by: params.systemUserId,
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

  const [numero, systemUserId] = await Promise.all([proximoNumeroOs(db), obterUsuarioSistema(db)]);

  const { data, error } = await db
    .schema("pcm")
    .from("ordens_servico")
    .insert(montarLinhaOs(input, { clienteId, numero, systemUserId }))
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id as string, status: input.status };
}
