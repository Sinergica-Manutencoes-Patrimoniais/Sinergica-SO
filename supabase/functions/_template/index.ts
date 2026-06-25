// Template de Edge Function (Deno) — copie para supabase/functions/<nome>/index.ts e adapte.
// Camadas de segurança obrigatórias (baseline mínimo): CORS restrito → JWT → Zod → lógica →
// resposta. Erros em problem+json (RFC 7807), log com reqId, nunca vaza stack ao cliente.
// Espelha a borda HTTP do Node (src/interfaces/http/) no runtime Deno do Supabase.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";

const FN = "nome-da-fn";

// Adapte o schema de entrada da sua função:
const InputSchema = z.object({
  vendaId: z.string().min(1),
  valorVendaReais: z.number().nonnegative(),
});

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    // 1) Autenticação (nunca confiar em identidade vinda do body)
    const { userId } = await requireAuth(req);

    // 2) Validação de input na borda
    const input = InputSchema.parse(await req.json());

    // 3) Lógica de negócio — delegue ao caso de uso/domínio. Valores sensíveis vêm do banco,
    //    não do client. (Aqui é só o esqueleto da borda.)
    const resultado = { ok: true, userId, vendaId: input.vendaId };

    // 4) Resposta
    return json(200, resultado, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado" }));
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
    403: "Forbidden",
    404: "Not Found",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    503: "Service Unavailable",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
