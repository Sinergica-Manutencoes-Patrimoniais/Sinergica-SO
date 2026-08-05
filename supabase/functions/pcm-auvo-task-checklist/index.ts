// pcm-auvo-task-checklist — leitura autenticada do checklist atual de uma tarefa Auvo (E01-S130).
// O frontend nunca recebe credenciais Auvo: esta borda valida o operador PCM e devolve somente o
// checklist normalizado, para o import de assessment classificar localmente via a Edge de IA.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";
import { AuvoApiError, auvoGet } from "../_shared/auvo/client.ts";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const [, payload] = token.split(".");
  if (!payload) return {};
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      user_role?: string;
      user_modulos?: Record<string, string>;
    };
  } catch {
    return {};
  }
}

/** A API devolve a tarefa em `result`; payloads de webhook variam, então aceita os nomes já
 * reconhecidos pelo mapeador de Assessment sem expor o payload inteiro ao navegador. */
export function extrairChecklistAoVivo(payload: unknown): unknown[] {
  const root = isObject(payload) && isObject(payload.result) ? payload.result : payload;
  if (!isObject(root)) return [];
  for (const chave of ["checklist", "questionnaire", "questionario", "questions", "answers", "respostas"]) {
    const valor = root[chave];
    if (Array.isArray(valor)) return valor;
  }
  return [];
}

function taskIdFrom(body: unknown): number {
  const taskId = isObject(body) ? body.taskId : null;
  if (typeof taskId !== "number" || !Number.isInteger(taskId) || taskId <= 0) {
    throw new HttpError(400, "ID da tarefa Auvo inválido");
  }
  return taskId;
}

if (import.meta.main) {
  serve(async (req) => {
    const cors = corsHeaders(req.headers.get("Origin"));
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const reqId = crypto.randomUUID().slice(0, 8);
    try {
      if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
      await requireAuth(req);
      const claims = claimsFrom(req);
      if (claims.user_role !== "superadmin" && claims.user_modulos?.pcm !== "escrita") {
        throw new HttpError(403, "Sem permissão de escrita no PCM");
      }

      const taskId = taskIdFrom(await req.json().catch(() => null));
      const resposta = await auvoGet<unknown>(`/tasks/${taskId}`);
      return new Response(
        JSON.stringify({ taskId, checklist: extrairChecklistAoVivo(resposta) }),
        { status: 200, headers: { "Content-Type": "application/json", ...cors } },
      );
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof AuvoApiError ? 502 : 500;
      const detail =
        error instanceof AuvoApiError && error.status === 404
          ? "Tarefa não encontrada no Auvo"
          : status === 502
            ? "Auvo indisponível ao consultar a tarefa"
            : error instanceof Error
              ? error.message
              : "Não foi possível consultar a tarefa Auvo";
      console.error(JSON.stringify({ fn: "pcm-auvo-task-checklist", reqId, status, detail }));
      return new Response(
        JSON.stringify({ type: "about:blank", title: "Erro", status, detail, reqId }),
        { status, headers: { "Content-Type": "application/problem+json", ...cors } },
      );
    }
  });
}
