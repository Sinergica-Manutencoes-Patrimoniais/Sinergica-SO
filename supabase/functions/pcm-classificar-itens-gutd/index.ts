// pcm-classificar-itens-gutd — classifica itens de inspeção JÁ existentes em GUTd (E01-S143).
//
// Separada de `importar-relatorio-pdf` de propósito: lá a IA EXTRAI itens de um texto bruto e
// decide quantos são; aqui os N itens já existem e a IA só dá nota, devolvendo o índice de volta
// para o pareamento não depender de contagem nem de ordem.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";
import { classificarItensGutd } from "../_shared/classificar-itens-gutd.ts";

const InputSchema = z.object({ texto: z.string().trim().min(10).max(100_000) });

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const claims = claimsFrom(req);
    // Gerar backlog é escrita no PCM — leitura não basta (diferente do import, que é só sugestão).
    if (claims.user_role !== "superadmin" && claims.user_modulos?.pcm !== "escrita") {
      throw new HttpError(403, "Sem permissão de escrita no PCM");
    }
    const { texto } = InputSchema.parse(await req.json());
    return json(200, { itens: await classificarItensGutd(texto) }, cors);
  } catch (error) {
    const status =
      error instanceof HttpError ? error.status : error instanceof z.ZodError ? 422 : 500;
    const detail =
      error instanceof HttpError ? error.message : status === 422 ? "Input inválido" : "Erro interno";
    return json(status, { type: "about:blank", status, detail }, cors);
  }
});

function claimsFrom(req: Request): { user_role?: string; user_modulos?: Record<string, string> } {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const payload = token.split(".")[1] ?? "";
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
