// os-from-task.ts — E01-S34. Cria `pcm.ordens_servico` a partir de uma tarefa do Auvo que ainda
// não tem OS local (`auvo_task_id` desconhecido). Compartilhado por `pcm-auvo-webhook` (tempo
// real) e `pcm-auvo-tasks-import` (backfill/reconciliação) — nenhum dos dois duplica esta lógica.
//
// `client_id` é NOT NULL em `pcm.ordens_servico` (migration 0001): sem cliente já sincronizado no
// PCM (`pcm.clientes.auvo_id`), a tarefa é pulada (devolve `null`, nunca lança) — o import de
// reconciliação a pega depois, quando o cliente já estiver sincronizado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  db: ReturnType<typeof createClient>,
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

/** Mesma lógica de `pcm-ze-agent` (`proximoNumeroChamado`) — `count()` tem race condition
 * conhecida sob concorrência real, mesma dívida já documentada e aceita nesse padrão (E01-S02). */
export async function proximoNumeroOs(db: ReturnType<typeof createClient>): Promise<string> {
  const { count, error } = await db
    .schema("pcm")
    .from("ordens_servico")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return `CH-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

/** Mesmo padrão de `pcm-auvo-customers-import` (`obterUsuarioSistema`): primeiro
 * superadmin/supervisor ativo, usado como `created_by` para registros que o próprio Auvo origina
 * (não têm um usuário PCM real por trás). */
export async function obterUsuarioSistema(db: ReturnType<typeof createClient>): Promise<string> {
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

/** Cria a OS a partir de uma tarefa Auvo sem `auvo_task_id` local correspondente. Devolve `null`
 * (sem lançar) quando o cliente ainda não está sincronizado — AC-4: nunca quebra o chamador. */
export async function criarOsDaTarefa(
  db: ReturnType<typeof createClient>,
  input: CriarOsDaTarefaInput,
): Promise<OsCriada | null> {
  const clienteId = await resolverClienteIdPorAuvoId(db, input.customerId);
  if (!clienteId) return null;

  const [numero, systemUserId] = await Promise.all([proximoNumeroOs(db), obterUsuarioSistema(db)]);

  const { data, error } = await db
    .schema("pcm")
    .from("ordens_servico")
    .insert({
      client_id: clienteId,
      numero,
      titulo: input.titulo,
      categoria: "corretiva", // AUTO-DECISION: Auvo não tem campo equivalente a categoria do PCM — ver design.md
      status: input.status,
      origem: "auvo",
      origem_ref_id: String(input.taskId),
      auvo_task_id: input.taskId,
      auvo_sync_status: "synced",
      auvo_synced_at: new Date().toISOString(),
      created_by: systemUserId,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id as string, status: input.status };
}
