// pcm-auvo-push — drain genérico do outbox de sync PCM→Auvo (E01-S22). Reivindica um lote
// `pending` via `pcm.fn_claim_auvo_outbox_batch` (UPDATE...FOR UPDATE SKIP LOCKED atômico — evita
// duas invocações concorrentes do drain pegarem a mesma linha, AC-3/AC-5), resolve o descriptor de
// cada linha pelo entity registry (`_shared/auvo/registry/`) e chama o Auvo com idempotência por
// `externalId = row_id` (ADR-0001). Nunca lança para o chamador nem trava o lote por uma linha com
// falha (try/catch por linha, mesmo padrão de `pcm-auvo-customers-import`).
//
// Invocada por `pg_cron` a cada 1 min (migration 0025) via `pg_net`, reusando os secrets do Vault
// já criados em `0011`/`0013` — sem secret novo. Ver specs/E01-S22-motor-sync-auvo-write/{design.md,spec.md}.
//
// AC-3, AC-4, AC-5, AC-6, AC-7 de specs/E01-S22-motor-sync-auvo-write/spec.md.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem executado.
// A lógica de decisão por linha (`processOutboxRow`) é testada isoladamente contra um stub de
// `OutboxRowDb` (sem depender do cliente real do Supabase) em `index.test.ts`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoDelete, auvoPatch, auvoPost } from "../_shared/auvo/client.ts";
import { toAuvoJsonPatch } from "../_shared/auvo/json-patch.ts";
import { getDescriptor } from "../_shared/auvo/registry/index.ts";
import type { AuvoEntityDescriptor } from "../_shared/auvo/registry/types.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";

const FN = "pcm-auvo-push";

/** Tamanho do lote por invocação — bem abaixo do rate limit do Auvo (400 req/min), já que o cron
 * dispara a cada 1 min (ver design.md → Questões em aberto). */
const BATCH_SIZE = 20;

export interface OutboxRow {
  id: string;
  entity: string;
  row_id: string;
  op: "create" | "update" | "delete";
  attempts: number;
}

/** Porta mínima de acesso a dados usada por `processOutboxRow` — permite testar a lógica de
 * decisão (idempotência, writeEnabled, delete vs create/update) sem um Postgres real. A
 * implementação concreta (`makeSupabaseOutboxRowDb`) envolve o cliente Supabase de verdade. */
export interface OutboxRowDb {
  fetchOrigem(table: string, rowId: string): Promise<Record<string, unknown> | null>;
  applyAuvoSync(table: string, rowId: string, patch: Record<string, unknown>): Promise<void>;
  /** Espelha o `writeEnabled` do descriptor em `pcm.auvo_entity_status` (E00-S11) — a única forma
   * de uma view SQL saber se uma entidade está em dry-run de propósito (não é erro) ou se algo
   * quebrou. Chamado uma vez por entidade vista no lote, nunca por linha. */
  upsertEntityStatus(entity: string, writeEnabled: boolean): Promise<void>;
}

export interface ProcessResult {
  ok: boolean;
  /** Presente só quando `ok=false` — motivo, nunca uma exceção (facilita gravar em `last_error`). */
  error?: string;
}

/**
 * Decide e executa o que fazer com UMA linha do outbox já reivindicada. Nunca lança por conta
 * própria erros "esperados" (descriptor ausente, writeEnabled=false, linha de origem sumida) —
 * devolve `{ ok:false, error }` para o chamador gravar em `auvo_sync_outbox.last_error` (AC-6).
 * Erros inesperados (rede, Auvo 5xx) propagam — o chamador (`serve`, abaixo) os captura por linha.
 */
export async function processOutboxRow(
  db: OutboxRowDb,
  row: OutboxRow,
  descriptor: AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>> | undefined,
): Promise<ProcessResult> {
  if (!descriptor) {
    return { ok: false, error: `descriptor desconhecido para entity="${row.entity}"` };
  }

  if (!descriptor.writeEnabled) {
    // AC-6: pulado por dry-run, NUNCA chama o Auvo — mensagem explícita para não confundir com
    // falha real de rede/Auvo (ver spec.md → AC-6).
    return { ok: false, error: "writeEnabled=false, pulado (dry-run)" };
  }

  const origem = await db.fetchOrigem(descriptor.pcmTable, row.row_id);
  if (!origem) {
    return { ok: false, error: `linha de origem ${row.row_id} não encontrada em pcm.${descriptor.pcmTable}` };
  }

  const existingAuvoId = origem["auvo_id"] as number | null | undefined;

  if (row.op === "delete") {
    if (existingAuvoId != null && descriptor.deleteStrategy !== "unsupported") {
      if (descriptor.deleteStrategy === "hard-delete") {
        await auvoDelete(`${descriptor.auvoBasePath}/${existingAuvoId}`);
      } else {
        // Padrão 'soft-patch': decisão do usuário — delete no PCM nunca é DELETE físico no Auvo
        // por padrão (ver design.md → Non-goals). O campo de "desativado" varia por entidade
        // (`active` na maioria, `unavailableForTasks` em Users) — `deactivatePatch` do descriptor
        // decide; ausente = `{active:false}`. PATCH da Auvo v2 é JSON Patch, não objeto flat —
        // ver _shared/auvo/json-patch.ts.
        const patch = descriptor.deactivatePatch ?? { active: false };
        await auvoPatch(`${descriptor.auvoBasePath}/${existingAuvoId}`, toAuvoJsonPatch(patch));
      }
    }
    // 'unsupported' (ex. Teams: sem PATCH/DELETE): exclusão fica só local, nenhuma chamada ao Auvo.
    await db.applyAuvoSync(descriptor.pcmTable, row.row_id, {
      auvo_sync_status: "synced",
      auvo_synced_at: new Date().toISOString(),
      auvo_sync_error: null,
    });
    return { ok: true };
  }

  // Recurso sem endpoint de edição no Auvo (ex. /customergroups): update é no-op de sucesso, não
  // tenta um PATCH que não existe.
  if (row.op === "update" && descriptor.supportsUpdate === false) {
    return { ok: true };
  }

  // create/update: AC-4 — se já existe auvo_id, é sempre PATCH (nunca um novo POST de criação),
  // mesmo que a linha do outbox diga `op='create'` (corrida entre duas fontes de escrita).
  let auvoId: number;
  if (existingAuvoId != null) {
    // PATCH da Auvo v2 é JSON Patch (`[{op:"replace",path,value}]`), não o objeto flat de
    // `toAuvo()` — confirmado no catálogo (Task Types/Services/Equipments/Products/Tickets, todos
    // com o mesmo dialeto). Ver _shared/auvo/json-patch.ts. `toAuvoUpdate`, se definido, restringe
    // o patch a um subconjunto de campos editáveis (ex.: Tickets só documenta `statusId`) — cai
    // para `toAuvo()` completo quando ausente, mesmo comportamento de todas as outras entidades.
    const patchPayload = descriptor.toAuvoUpdate?.(origem) ?? descriptor.toAuvo(origem);
    await auvoPatch(`${descriptor.auvoBasePath}/${existingAuvoId}`, toAuvoJsonPatch(patchPayload));
    auvoId = existingAuvoId;
  } else {
    // Idempotência por ADR-0001 — nome do campo varia por recurso (a maioria usa `externalId`,
    // `Services` usa `externalCode`, confirmado no catálogo). Nunca hardcodar o nome do campo.
    const externalIdField = descriptor.externalIdField ?? "externalId";
    const criado = await auvoPost<{ result: { id: number } }>(descriptor.auvoBasePath, {
      ...descriptor.toAuvo(origem),
      [externalIdField]: row.row_id,
    });
    auvoId = criado.result.id;
  }

  await db.applyAuvoSync(descriptor.pcmTable, row.row_id, {
    auvo_id: auvoId,
    auvo_sync_status: "synced",
    auvo_synced_at: new Date().toISOString(),
    auvo_sync_error: null,
  });

  return { ok: true };
}

function makeSupabaseOutboxRowDb(db: UntypedSupabaseClient): OutboxRowDb {
  return {
    async fetchOrigem(table, rowId) {
      const { data, error } = await db.schema("pcm").from(table).select("*").eq("id", rowId).maybeSingle();
      if (error) throw error;
      return (data as Record<string, unknown> | null) ?? null;
    },
    async applyAuvoSync(table, rowId, patch) {
      const { error } = await db.schema("pcm").rpc("fn_apply_auvo_sync", {
        p_table: table,
        p_row_id: rowId,
        p_patch: patch,
      });
      if (error) throw error;
    },
    async upsertEntityStatus(entity, writeEnabled) {
      const { error } = await db
        .schema("pcm")
        .from("auvo_entity_status")
        .upsert({ entity, write_enabled: writeEnabled, updated_at: new Date().toISOString() }, { onConflict: "entity" });
      // Nunca deixa a saúde-de-sync (visibilidade) derrubar o drain (função) — só loga.
      if (error) console.error(JSON.stringify({ nivel: "error", fn: FN, msg: "falha ao gravar auvo_entity_status", entity, detail: error.message }));
    },
  };
}

if (import.meta.main) serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    // Auth — chamada interna sistema→sistema (cron), nunca frontend.
    requireServiceRole(req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const supa = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const rowDb = makeSupabaseOutboxRowDb(supa);

    // Reivindica o lote atomicamente (pending → processing) — AC-3, AC-5.
    const { data: lote, error: loteError } = await supa
      .schema("pcm")
      .rpc("fn_claim_auvo_outbox_batch", { p_limit: BATCH_SIZE });
    if (loteError) throw loteError;

    const linhas = (lote ?? []) as OutboxRow[];
    let sent = 0;
    let failed = 0;
    const entidadesVistas = new Set<string>();

    for (const linha of linhas) {
      const descriptor = getDescriptor(linha.entity) as
        | AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>>
        | undefined;

      // E00-S11: espelha write_enabled uma vez por entidade (não por linha) — visibilidade de
      // saúde de sync, nunca bloqueia o processamento da linha em si.
      if (descriptor && !entidadesVistas.has(linha.entity)) {
        entidadesVistas.add(linha.entity);
        await rowDb.upsertEntityStatus(linha.entity, descriptor.writeEnabled);
      }

      let resultado: ProcessResult;
      try {
        resultado = await processOutboxRow(rowDb, linha, descriptor);
      } catch (rowError) {
        // Erro inesperado (rede, Auvo 5xx, banco) — não trava o lote (AC-5): registra e segue.
        const detail =
          rowError instanceof AuvoApiError
            ? `Auvo ${rowError.status}: ${rowError.message}${rowError.requestId ? ` (X-Request-Id: ${rowError.requestId})` : ""}`
            : rowError instanceof Error
              ? rowError.message
              : String(rowError);
        console.error(
          JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha ao processar linha do outbox", entity: linha.entity, rowId: linha.row_id, detail }),
        );
        resultado = { ok: false, error: detail };
      }

      const update = resultado.ok
        ? { status: "sent", sent_at: new Date().toISOString() }
        : { status: "error", attempts: linha.attempts + 1, last_error: (resultado.error ?? "").slice(0, 2000) };

      const { error: updateError } = await supa.schema("pcm").from("auvo_sync_outbox").update(update).eq("id", linha.id);
      if (updateError) {
        // Não deixa uma falha ao GRAVAR o resultado mascarar o resultado original — só loga.
        console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha ao atualizar status do outbox", outboxId: linha.id, detail: updateError.message }));
      }

      if (resultado.ok) sent++;
      else failed++;
    }

    const resultadoFinal = { claimed: linhas.length, sent, failed };
    console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, msg: "drain concluído", ...resultadoFinal }));
    return json(200, resultadoFinal, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, `Auvo indisponível ou erro: ${e.message}`, reqId, cors);
    }
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors); // nunca vaza stack
  }
});

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(status: number, detail: string, reqId: string, cors: Record<string, string>): Response {
  const titles: Record<number, string> = {
    401: "Unauthorized",
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
