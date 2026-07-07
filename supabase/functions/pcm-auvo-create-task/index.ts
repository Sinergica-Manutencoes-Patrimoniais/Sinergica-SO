// pcm-auvo-create-task — cria task no Auvo quando uma OS entra em `planejamento`.
// Invocada de forma assíncrona pelo trigger `pg_net` em pcm.ordens_servico (migration
// NNNN_E01-S09_trigger_auvo_planejamento.sql) — ninguém espera a resposta HTTP desta função no
// fluxo do usuário; ela existe para deixar a OS num estado limpo/informativo
// (`auvo_sync_status`/`auvo_task_id`/`auvo_sync_error`), nunca para travar o PCM.
// AC-4, AC-5, AC-6, AC-7 de specs/E01-S09-integracao-auvo-fundacao/spec.md.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem
// executado contra a API real do Auvo. Ver relatório da story para o que falta confirmar.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, auvoPost, buildParamFilter } from "../_shared/auvo/client.ts";
import { resolveAuvoTaskTypeId } from "../_shared/auvo/task-type-map.ts";
import { resolveAuvoPriority } from "../_shared/auvo/priority-map.ts";

const FN = "pcm-auvo-create-task";

const InputSchema = z.object({
  osId: z.string().uuid(),
});

interface AuvoTask {
  id: number;
  externalId?: string;
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    // 1) Autenticação — chamada interna (trigger pg_net), não usuário final.
    requireServiceRole(req);

    // 2) Validação de input na borda.
    const input = InputSchema.parse(await req.json());

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 3) Busca a OS.
    const { data: os, error: osError } = await db
      .schema("pcm")
      .from("ordens_servico")
      .select("id, client_id, categoria, prioridade, titulo, descricao, auvo_task_id")
      .eq("id", input.osId)
      .maybeSingle();

    if (osError) throw osError;
    if (!os) throw new HttpError(404, `OS ${input.osId} não encontrada`);

    // AC-5: idempotente — já sincronizada, no-op (sem nova chamada ao Auvo).
    if (os.auvo_task_id != null) {
      return json(200, { ok: true, taskId: os.auvo_task_id, created: false }, cors);
    }

    // AC-7: categoria sem taskTypeId mapeado — falha explícita, NENHUMA chamada POST /tasks.
    const taskTypeId = resolveAuvoTaskTypeId(os.categoria);
    if (taskTypeId === undefined) {
      await markFailed(db, input.osId, `taskTypeId não configurado para categoria ${os.categoria}`);
      return json(200, { ok: false, reason: "taskTypeId_not_mapped", categoria: os.categoria }, cors);
    }

    // A partir daqui, qualquer falha (DB ou Auvo) grava auvo_sync_status='failed' e retorna 200
    // — nunca propaga exceção ao chamador (AC-6: falha do Auvo nunca bloqueia o PCM; aqui, além
    // disso, nem sequer existe "usuário" esperando, é a Edge Function invocada pelo trigger).
    try {
      // 4) Garante que o cliente tem auvo_id — fallback síncrono via pcm-auvo-customers-sync
      // (a via principal é o cliente já sincronizado antes, ver spec.md → Casos de borda).
      const { data: cliente, error: clienteError } = await db
        .schema("pcm")
        .from("clientes")
        .select("id, auvo_id")
        .eq("id", os.client_id)
        .maybeSingle();
      if (clienteError) throw clienteError;
      if (!cliente) throw new Error(`Cliente ${os.client_id} da OS ${input.osId} não encontrado`);

      let customerId: number | null = cliente.auvo_id;
      if (customerId == null) {
        customerId = await syncClienteFallback(supabaseUrl, serviceKey, os.client_id);
      }

      // 5) Idempotência no Auvo: busca por externalId antes de criar (AC-5, reprocesso de trigger).
      // Correção de revisão: não cair para search.result[0] sem bater o externalId — mesmo risco
      // documentado em pcm-auvo-customers-sync (vincularia a task errada se o paramFilter não
      // filtrar como esperado no lado do Auvo).
      let existente: AuvoTask | undefined;
      try {
        const search = await auvoGet<{ result: AuvoTask[] }>(
          `/tasks?${buildParamFilter({ externalId: input.osId })}`,
        );
        existente = search?.result?.find((t) => t.externalId === input.osId);
      } catch (searchError) {
        if (!(searchError instanceof AuvoApiError) || searchError.status !== 400) {
          throw searchError;
        }
        console.warn(
          JSON.stringify({
            ts: new Date().toISOString(),
            nivel: "warn",
            fn: FN,
            reqId,
            msg: "Auvo rejeitou busca de task por externalId; seguindo para criação com externalId",
            osId: input.osId,
            detail: searchError.message,
          }),
        );
      }

      let taskId: number;
      if (existente) {
        taskId = existente.id;
      } else {
        const criada = await auvoPost<{ result: { id: number } }>("/tasks", {
          externalId: input.osId,
          customerId,
          taskTypeId,
          priority: resolveAuvoPriority(os.prioridade),
          orientation: os.descricao ?? os.titulo,
        });
        taskId = criada.result.id;
      }

      // 6) Grava sucesso.
      const { error: updateError } = await db
        .schema("pcm")
        .from("ordens_servico")
        .update({
          auvo_task_id: taskId,
          auvo_sync_status: "synced",
          auvo_synced_at: new Date().toISOString(),
          auvo_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.osId);
      if (updateError) throw updateError;

      return json(200, { ok: true, taskId, created: !existente }, cors);
    } catch (inner) {
      const detail =
        inner instanceof AuvoApiError
          ? `Auvo ${inner.status}: ${inner.message}${inner.requestId ? ` (X-Request-Id: ${inner.requestId})` : ""}`
          : inner instanceof Error
            ? inner.message
            : String(inner);

      console.error(
        JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "falha ao criar task Auvo", osId: input.osId, detail }),
      );

      await markFailed(db, input.osId, detail);
      return json(200, { ok: false, reason: "sync_failed", detail }, cors);
    }
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors); // nunca vaza stack
  }
});

/** Chama pcm-auvo-customers-sync internamente (mesma auth de service_role) e retorna o customerId. */
async function syncClienteFallback(supabaseUrl: string, serviceKey: string, clienteId: string): Promise<number> {
  const res = await fetch(`${supabaseUrl}/functions/v1/pcm-auvo-customers-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ clienteId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Falha no fallback de sync de cliente (status ${res.status}): ${body}`);
  }
  const data = await res.json();
  if (typeof data?.customerId !== "number") {
    throw new Error("Fallback de sync de cliente não retornou customerId");
  }
  return data.customerId;
}

/** Grava auvo_sync_status='failed' + auvo_sync_error na OS. Nunca lança — loga se a própria
 * escrita falhar, para não mascarar o erro original com um erro novo não tratado. */
async function markFailed(db: SupabaseClient, osId: string, errorMessage: string): Promise<void> {
  const { error } = await db
    .schema("pcm")
    .from("ordens_servico")
    .update({
      auvo_sync_status: "failed",
      auvo_sync_error: errorMessage.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", osId);
  if (error) {
    console.error(
      JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, msg: "falha ao gravar auvo_sync_status=failed", osId, detail: error.message }),
    );
  }
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    404: "Not Found",
    405: "Method Not Allowed",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
