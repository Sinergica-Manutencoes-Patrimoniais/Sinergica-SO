// E01-S125 — abertura de task Auvo sob demanda. O preview nunca chama o Auvo nem grava no banco.
// A confirmação delega ao handler interno legado, que preserva idempotência por externalId e o
// registro de falha em `auvo_sync_status`; o preview só exige módulo 'pcm' escrita, mas a
// CRIAÇÃO de verdade (E01-S196 AC-9/AC-10) é contingência: exige a capacidade própria
// `execucao.contingencia_auvo` e um motivo, auditados via `pcm.sso_registrar_contingencia_auvo`
// — módulo genérico nunca bastou pra isso, achado desta story.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { resolveAuvoPriority } from "../_shared/auvo/priority-map.ts";
import { resolveAuvoTaskTypeId } from "../_shared/auvo/task-type-map.ts";
import { envioLegadoBloqueado } from "../_shared/auvo/trava-envio-legado.ts";

const FN = "pcm-auvo-open-task";
const InputSchema = z.object({
  osId: z.string().uuid(),
  dryRun: z.boolean(),
  // E01-S196: obrigatório só pra confirmar de verdade (dryRun=false) — a validação condicional
  // fica no handler, não aqui, porque dryRun nunca grava e não deveria exigir motivo pra só olhar.
  requestId: z.string().uuid().optional(),
  motivo: z.string().trim().min(1).max(2000).optional(),
});

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  const payload = (req.headers.get("Authorization")?.replace("Bearer ", "") ?? "").split(".")[1];
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const claims = claimsFrom(req);
    if (claims.user_role !== "superadmin" && claims.user_modulos?.pcm !== "escrita") {
      throw new HttpError(403, "Sem permissão de escrita no PCM");
    }
    const input = InputSchema.parse(await req.json());
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url) throw new HttpError(500, "Ambiente Supabase incompleto");
    // Client no contexto do USUÁRIO (não service_role) — é o que faz `auth.uid()` dentro da RPC
    // de contingência ser o ator real, não o sistema. Nunca usado pra ler/gravar OS/Auvo.
    const dbUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    // biome-ignore lint/suspicious/noExplicitAny: schemas Supabase não têm tipos gerados no repo.
    const db: any = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: os, error: osError } = await db
      .schema("pcm")
      .from("ordens_servico")
      .select("id,client_id,categoria,prioridade,titulo,descricao,auvo_task_id,tipo_tarefa_id,tecnico_funcionario_id,data_agendada,local_descricao")
      .eq("id", input.osId)
      .is("deleted_at", null)
      .maybeSingle();
    if (osError) throw osError;
    if (!os) throw new HttpError(404, "OS não encontrada");

    const [{ data: cliente, error: clienteError }, { data: tecnico, error: tecnicoError }] = await Promise.all([
      db.schema("pcm").from("clientes").select("nome,auvo_id,endereco").eq("id", os.client_id).maybeSingle(),
      os.tecnico_funcionario_id
        ? db.schema("pcm").from("funcionarios").select("nome,auvo_user_id").eq("id", os.tecnico_funcionario_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (clienteError || tecnicoError) throw clienteError ?? tecnicoError;
    if (!cliente) throw new HttpError(422, "Cliente da OS não encontrado");

    let taskTypeId: number | undefined;
    if (os.tipo_tarefa_id) {
      const { data: tipo, error } = await db.schema("pcm").from("tipos_tarefa").select("nome,auvo_id").eq("id", os.tipo_tarefa_id).maybeSingle();
      if (error) throw error;
      taskTypeId = tipo?.auvo_id ?? undefined;
    }
    taskTypeId ??= resolveAuvoTaskTypeId(os.categoria);
    const pendencias: string[] = [];
    if (taskTypeId === undefined) pendencias.push("Tipo de tarefa Auvo não configurado para esta categoria.");
    if (os.auvo_task_id == null && envioLegadoBloqueado(Deno.env.get("SSO_BLOQUEAR_ENVIO_LEGADO_AUVO")))
      pendencias.push("Abertura legada bloqueada durante a transição Auvo.");
    const preview = {
      jaAberta: os.auvo_task_id != null,
      taskIdExistente: os.auvo_task_id,
      podeAbrir: os.auvo_task_id == null && pendencias.length === 0,
      pendencias,
      // `payload` contém exclusivamente chaves do contrato atual E01-S09. Não acrescentar
      // técnico/data/local ao POST sem confirmar contrato Auvo (E01-S121).
      payload: {
        externalId: os.id,
        customerId: cliente.auvo_id,
        taskTypeId: taskTypeId ?? null,
        priority: resolveAuvoPriority(os.prioridade),
        orientation: os.descricao ?? os.titulo,
      },
      conferenciaPcm: {
        cliente: cliente.nome,
        tecnico: tecnico?.nome ?? "Não atribuído",
        dataAgendada: os.data_agendada,
        local: os.local_descricao ?? cliente.endereco ?? null,
      },
    };
    if (input.dryRun || os.auvo_task_id != null || pendencias.length > 0) {
      return json(200, { ok: os.auvo_task_id != null || pendencias.length === 0, ...preview }, cors);
    }

    // E01-S196 AC-9/AC-10: só a partir daqui é "uso" de verdade do caminho manual (preview
    // acima nunca grava nem chama o Auvo). Exige capacidade própria + motivo + request_id
    // idempotente; o servidor re-checa (`sso_registrar_contingencia_auvo` chama
    // `sso_autorizar_acao` de novo), não confia no preview nem no front.
    if (!input.motivo || !input.requestId) {
      throw new HttpError(422, "Motivo e requestId são obrigatórios para confirmar a abertura.");
    }
    const { error: contingenciaError } = await dbUsuario.schema("pcm").rpc("sso_registrar_contingencia_auvo", {
      p_request_id: input.requestId,
      p_cliente_id: os.client_id,
      p_os_id: os.id,
      p_motivo: input.motivo,
    });
    if (contingenciaError) {
      if (contingenciaError.message?.includes("sem_acesso")) {
        throw new HttpError(403, "Sem capacidade de contingência Auvo para este Cliente.");
      }
      if (contingenciaError.message?.includes("contingencia_invalida")) {
        throw new HttpError(422, "Dados da contingência inválidos.");
      }
      if (contingenciaError.message?.includes("os_indisponivel")) {
        throw new HttpError(404, "OS não encontrada para registrar a contingência.");
      }
      if (contingenciaError.message?.includes("request_conflitante")) {
        throw new HttpError(409, "Tentativa anterior com dados diferentes — recarregue e repita.");
      }
      throw contingenciaError;
    }

    // Reserva atômica antes da chamada remota: evita dois operadores criarem a mesma task entre
    // o GET externalId e o POST. Falha do handler legado muda `opening` para `failed`; reserva
    // abandonada expira no banco após 5min (migration 0169).
    const { data: reservada, error: reservaError } = await db
      .schema("pcm")
      .rpc("fn_iniciar_abertura_auvo", { p_os_id: os.id });
    if (reservaError) throw reservaError;
    if (!reservada) {
      const { data: atual, error: atualError } = await db
        .schema("pcm")
        .from("ordens_servico")
        .select("auvo_task_id")
        .eq("id", os.id)
        .maybeSingle();
      if (atualError) throw atualError;
      if (atual?.auvo_task_id != null) {
        return json(200, { ok: true, taskId: atual.auvo_task_id, created: false, preview }, cors);
      }
      return json(200, {
        ok: false,
        reason: "opening_in_progress",
        detail: "Abertura no Auvo já está em andamento. Aguarde alguns segundos e atualize.",
        preview,
      }, cors);
    }

    const response = await fetch(`${url}/functions/v1/pcm-auvo-create-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ osId: os.id }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new HttpError(502, "Não foi possível abrir task no Auvo");
    console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, osId: os.id, ok: result?.ok === true }));
    return json(200, { ...result, preview }, cors);
  } catch (error) {
    if (error instanceof HttpError) return problem(error.status, error.message, reqId, cors);
    if (error instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(error) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ type: "about:blank", title: "Error", status, detail, reqId }), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
