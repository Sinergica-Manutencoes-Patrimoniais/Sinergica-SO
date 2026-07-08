// atendimento-metrics — snapshot server-side do painel de Atendimento (E02-S10). Chama a RPC
// `atendimento.fn_metrics_snapshot(periodo)` repassando o JWT do usuário final (nunca a
// service_role key) para que as policies de RLS de `atendimento.conversas`/`mensagens` (0039/0040)
// se apliquem normalmente — a RPC roda `security invoker` de propósito, ver migration 0052.
//
// NÃO VERIFICADO NESTE AMBIENTE: sem Deno CLI aqui, este código não foi type-checked nem executado.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";

const FN = "atendimento-metrics";
const PERIODOS_VALIDOS = ["hoje", "7d", "30d"] as const;
type Periodo = (typeof PERIODOS_VALIDOS)[number];

function ehPeriodoValido(valor: unknown): valor is Periodo {
  return typeof valor === "string" && (PERIODOS_VALIDOS as readonly string[]).includes(valor);
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  console.log(JSON.stringify({ ts: now, nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    await requireAuth(req);

    const body = (await req.json().catch(() => ({}))) as { periodo?: unknown };
    const periodo: Periodo = ehPeriodoValido(body.periodo) ? body.periodo : "hoje";

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!url || !anonKey) throw new HttpError(500, "Ambiente Supabase incompleto");

    // Repassa o Authorization original (JWT do usuário) — não usa service_role. É isso que faz a
    // RLS de conversas/mensagens (e portanto a permissão de módulo Atendimento) valer dentro da RPC.
    const db = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data, error } = await db.schema("atendimento").rpc("fn_metrics_snapshot", { p_periodo: periodo });
    if (error) throw error;

    return json(200, data, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    console.error(JSON.stringify({ ts: now, nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
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
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
