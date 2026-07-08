// pcm-auvo-ferramenta-alocacao — ação dedicada para /products/employee-product-stock.
// Não usa o outbox genérico porque o endpoint do Auvo é uma ação PUT sem recurso próprio/id.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { AuvoApiError, auvoPut } from "../_shared/auvo/client.ts";

const FN = "pcm-auvo-ferramenta-alocacao";

interface Input {
  ferramentaId?: string;
  ferramentaAuvoId?: number;
  funcionarioId?: string | null;
  tecnicoAuvoId?: number;
  quantidade?: number;
}

interface FerramentaRow {
  id: string;
  auvo_id: number | null;
  quantidade_total: number;
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    const { userId } = await requireAuth(req);
    const claims = claimsFrom(req);
    if (claims.user_role !== "superadmin" && claims.user_modulos?.pcm !== "escrita") {
      throw new HttpError(403, "Sem permissão de escrita no PCM");
    }

    const input = validar(await req.json().catch(() => ({})));
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const ferramenta = await resolverFerramenta(db, input);
    if (!ferramenta.auvo_id) throw new HttpError(409, "Ferramenta ainda não está sincronizada com o Auvo");
    await validarQuantidadeTotal(db, ferramenta, input.tecnicoAuvoId, input.quantidade);

    await auvoPut("/products/employee-product-stock", {
      userId: input.tecnicoAuvoId,
      productId: ferramenta.auvo_id,
      amount: input.quantidade,
    });

    let funcionarioId = input.funcionarioId;
    if (!funcionarioId) {
      const { data: funcionario, error: funcionarioError } = await db
          .schema("pcm")
          .from("funcionarios")
          .select("id")
          .eq("auvo_user_id", input.tecnicoAuvoId)
          .maybeSingle();
      if (funcionarioError) throw funcionarioError;
      funcionarioId = (funcionario?.id as string | undefined) ?? null;
    }

    const { error } = await db.schema("pcm").from("ferramenta_alocacoes").upsert(
      {
        ferramenta_id: ferramenta.id,
        auvo_user_id: input.tecnicoAuvoId,
        funcionario_id: funcionarioId,
        quantidade: input.quantidade,
        origem_sync: "pcm",
        auvo_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: userId,
        created_by: userId,
      },
      { onConflict: "ferramenta_id,auvo_user_id" },
    );
    if (error) throw error;

    return json(200, { ok: true }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, "Auvo indisponível ou erro ao alocar ferramenta", reqId, cors);
    }
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

function validar(raw: unknown): Required<Input> {
  const input = raw as Input;
  const quantidade = Number(input.quantidade);
  if (!input.ferramentaId && !input.ferramentaAuvoId) throw new HttpError(400, "Ferramenta é obrigatória");
  if (!Number.isInteger(input.tecnicoAuvoId)) throw new HttpError(400, "Técnico sincronizado é obrigatório");
  if (!Number.isInteger(quantidade) || quantidade < 0) throw new HttpError(400, "Quantidade deve ser maior ou igual a zero");
  return {
    ferramentaId: String(input.ferramentaId ?? ""),
    ferramentaAuvoId: Number(input.ferramentaAuvoId ?? 0),
    funcionarioId: input.funcionarioId ? String(input.funcionarioId) : null,
    tecnicoAuvoId: Number(input.tecnicoAuvoId),
    quantidade,
  };
}

async function resolverFerramenta(db: UntypedSupabaseClient, input: Required<Input>): Promise<FerramentaRow> {
  let query = db.schema("pcm").from("ferramentas").select("id,auvo_id,quantidade_total").is("deleted_at", null);
  query = input.ferramentaId ? query.eq("id", input.ferramentaId) : query.eq("auvo_id", input.ferramentaAuvoId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Ferramenta não encontrada");
  return data as FerramentaRow;
}

async function validarQuantidadeTotal(
  db: UntypedSupabaseClient,
  ferramenta: FerramentaRow,
  tecnicoAuvoId: number,
  quantidade: number,
): Promise<void> {
  const { data, error } = await db
    .schema("pcm")
    .from("ferramenta_alocacoes")
    .select("auvo_user_id,quantidade")
    .eq("ferramenta_id", ferramenta.id);
  if (error) throw error;
  const total = (data ?? []).reduce((acc, row) => {
    const rowUser = Number(row.auvo_user_id);
    const rowQtd = Number(row.quantidade ?? 0);
    return acc + (rowUser === tecnicoAuvoId ? quantidade : rowQtd);
  }, 0);
  const jaExiste = (data ?? []).some((row) => Number(row.auvo_user_id) === tecnicoAuvoId);
  const totalFinal = jaExiste ? total : total + quantidade;
  if (totalFinal > ferramenta.quantidade_total) {
    throw new HttpError(409, "Quantidade alocada excede o estoque total da ferramenta");
  }
}

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const [, payload] = token.split(".");
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function problem(status: number, message: string, reqId: string, cors: Record<string, string>): Response {
  return json(status, { error: message, reqId }, cors);
}
