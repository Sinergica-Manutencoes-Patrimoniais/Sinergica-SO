// pcm-auvo-tickets-referencia — proxy autenticado para as listas de referência de Tickets
// (`GET /tickets/request-type`, `GET /tickets/status`). Não são entidades sincronizadas pelo motor
// genérico (sem `id` local, sem outbox) — são só listas para popular os <select> do formulário de
// novo Ticket (spec.md → AC-5). Chamada direta do frontend, sem cache (TTL curto não vale a pena
// para um catálogo pequeno consultado só ao abrir o formulário).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet } from "../_shared/auvo/client.ts";

const FN = "pcm-auvo-tickets-referencia";

type Lista = "request-type" | "status";

interface AuvoReferenciaResponse<T> {
  result?: T[] | { entityList?: T[] };
}

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    await requireAuth(req);
    const claims = claimsFrom(req);
    const podeAcessar = claims.user_role === "superadmin" || ["leitura", "escrita"].includes(claims.user_modulos?.pcm ?? "");
    if (!podeAcessar) throw new HttpError(403, "Sem permissão de leitura no PCM");

    const body = (await req.json().catch(() => ({}))) as { lista?: Lista };
    const lista = body.lista;
    if (lista !== "request-type" && lista !== "status") {
      throw new HttpError(400, "Campo lista deve ser 'request-type' ou 'status'");
    }

    const resposta = await auvoGet<AuvoReferenciaResponse<Record<string, unknown>>>(`/tickets/${lista}`);
    const itens = Array.isArray(resposta.result)
      ? resposta.result
      : Array.isArray(resposta.result?.entityList)
        ? resposta.result.entityList
        : [];

    return json(200, { itens }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, "Auvo indisponível ou erro ao buscar lista de referência", reqId, cors);
    }
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

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
