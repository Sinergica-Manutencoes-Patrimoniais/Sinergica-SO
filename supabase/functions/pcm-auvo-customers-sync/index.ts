// pcm-auvo-customers-sync — sincroniza pcm.clientes → cliente Auvo, idempotente por externalId.
// Chamada interna sistema→sistema (nunca pelo frontend): invocada pela `pcm-auvo-create-task`
// como fallback quando o cliente da OS ainda não tem `auvo_id` (ver spec.md → Casos de borda).
// AC-1, AC-2, AC-3 de specs/E01-S09-integracao-auvo-fundacao/spec.md.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem
// executado contra a API real do Auvo. Ver relatório da story para o que falta confirmar.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet, auvoPost, buildParamFilter } from "../_shared/auvo/client.ts";

const FN = "pcm-auvo-customers-sync";

const InputSchema = z.object({
  clienteId: z.string().uuid(),
});

interface AuvoCustomer {
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

    // 1) Autenticação — chamada interna, não usuário final.
    requireServiceRole(req);

    // 2) Validação de input na borda.
    const input = InputSchema.parse(await req.json());

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 3) Busca o cliente no PCM.
    const { data: cliente, error: clienteError } = await db
      .schema("pcm")
      .from("clientes")
      .select("id, nome, auvo_id")
      .eq("id", input.clienteId)
      .maybeSingle();

    if (clienteError) throw clienteError;
    if (!cliente) throw new HttpError(404, `Cliente ${input.clienteId} não encontrado`);

    // AC-2: idempotente — cliente já sincronizado, nenhuma chamada POST /customers.
    if (cliente.auvo_id != null) {
      return json(200, { customerId: cliente.auvo_id, created: false }, cors);
    }

    // AC-1 / AC-3: busca por externalId antes de criar — evita duplicar cliente já existente
    // no Auvo (uso manual anterior a esta integração).
    // SPEC_DEVIATION: design.md → Contrato dos dados trocados lista `clientes.endereco` → `address`,
    // mas `pcm.clientes` (migration 0001_E00-S00) não tem coluna `endereco` — só `nome`/`cnpj`.
    // Envia apenas `description` (nome) até a coluna existir; registrado em tasks.md.
    // Correção de revisão: NÃO cair para search.result[0] se nada bater com o externalId — se o
    // paramFilter não filtrar como esperado no lado do Auvo (formato não verificado neste
    // ambiente, ver nota no topo do arquivo), pegar "o primeiro resultado" vincularia um cliente
    // Auvo ERRADO ao registro do PCM. Melhor tratar como "não encontrado" e criar um novo — pior
    // caso é um cliente duplicado no Auvo (recuperável), não um vínculo cruzado silencioso.
    const search = await auvoGet<{ result: AuvoCustomer[] }>(
      `/customers?${buildParamFilter({ externalId: input.clienteId })}`,
    );
    const existente = search?.result?.find((c) => c.externalId === input.clienteId);

    let customerId: number;
    let created: boolean;
    if (existente) {
      customerId = existente.id;
      created = false;
    } else {
      const criado = await auvoPost<{ result: { id: number } }>("/customers", {
        externalId: input.clienteId,
        description: cliente.nome,
      });
      customerId = criado.result.id;
      created = true;
    }

    // 4) Grava o vínculo de volta no PCM via `fn_apply_auvo_sync` — a mesma RPC anti-loop do motor
    //    genérico (E01-S22), que seta `app.auvo_sync_write` ANTES de gravar. Sem isso,
    //    `trg_clientes_auvo_enqueue` (E01-S27) reenfileiraria esta escrita como se fosse uma mudança
    //    local a empurrar de volta pro Auvo — inofensivo hoje só por `writeEnabled:false`, vira eco
    //    assim que for ligado (achado C2 da revisão adversarial de 2026-07-07).
    const { error: updateError } = await db.schema("pcm").rpc("fn_apply_auvo_sync", {
      p_table: "clientes",
      p_row_id: input.clienteId,
      p_patch: { auvo_id: customerId, updated_at: new Date().toISOString() },
    });
    if (updateError) throw updateError;

    return json(200, { customerId, created }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(
        JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }),
      );
      return problem(502, `Auvo indisponível ou erro: ${e.message}`, reqId, cors);
    }
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
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
    400: "Bad Request",
    401: "Unauthorized",
    404: "Not Found",
    405: "Method Not Allowed",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    502: "Bad Gateway",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
