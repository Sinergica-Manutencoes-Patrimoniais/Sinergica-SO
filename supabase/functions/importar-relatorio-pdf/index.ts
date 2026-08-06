// importar-relatorio-pdf — transforma texto extraído de relatório em itens estruturados.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";
import { classificarRelatorioInspecao } from "../_shared/classificar-relatorio-inspecao.ts";

const InputSchema = z.object({ texto: z.string().trim().min(20).max(100_000) });

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const claims = claimsFrom(req);
    if (
      claims.user_role !== "superadmin" &&
      !["leitura", "escrita"].includes(claims.user_modulos?.pcm ?? "")
    ) {
      throw new HttpError(403, "Sem permissão de leitura no PCM");
    }
    const { texto } = InputSchema.parse(await req.json());
    return json(200, { itens: await classificarRelatorioInspecao(texto) }, cors);
  } catch (error) {
    const status =
      error instanceof HttpError ? error.status : error instanceof z.ZodError ? 422 : 500;
    const detail = error instanceof HttpError ? error.message : status === 422 ? "Input inválido" : "Erro interno";
    return json(status, { type: "about:blank", status, detail }, cors);
  }
});

function claimsFrom(req: Request): {
  user_role?: string;
  user_modulos?: Record<string, string>;
} {
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
