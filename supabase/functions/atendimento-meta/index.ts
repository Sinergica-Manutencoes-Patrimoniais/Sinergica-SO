import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HttpError, requireAuth } from "../_shared/auth.ts";
import { metaRequest } from "../_shared/meta.ts";

const InputSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("verificar"), canalId: z.string().uuid() }),
  z.object({ acao: z.literal("criar_template"), templateId: z.string().uuid() }),
]);

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    await requireAuth(req);
    const input = InputSchema.parse(await req.json());
    const token = req.headers.get("Authorization") ?? "";
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: token } } },
    );
    if (input.acao === "criar_template") {
      const { data: template, error: templateError } = await db
        .schema("atendimento")
        .from("wa_templates")
        .select("id,nome,idioma,categoria,corpo,canal_id")
        .eq("id", input.templateId)
        .maybeSingle();
      if (templateError) throw templateError;
      if (!template) throw new HttpError(404, "Template não encontrado");
      const { data: canal, error: canalError } = await db
        .schema("atendimento")
        .from("canais_externos")
        .select("waba_id")
        .eq("id", template.canal_id)
        .maybeSingle();
      if (canalError) throw canalError;
      if (!canal?.waba_id) throw new HttpError(400, "WABA ID não configurado");
      await metaRequest(`${encodeURIComponent(canal.waba_id)}/message_templates`, {
        method: "POST",
        body: JSON.stringify({
          name: template.nome,
          language: template.idioma,
          category: String(template.categoria).toUpperCase(),
          components: [{ type: "BODY", text: template.corpo }],
        }),
      });
      return json(200, { ok: true, status: "pending" }, cors);
    }

    const { data: canal, error } = await db
      .schema("atendimento")
      .from("canais_externos")
      .select("id,tipo,identificador_externo")
      .eq("id", input.canalId)
      .maybeSingle();
    if (error) throw error;
    if (!canal?.identificador_externo) throw new HttpError(404, "Canal sem identificador");
    try {
      await metaRequest(`${encodeURIComponent(canal.identificador_externo)}?fields=id,name`);
      const { error: updateError } = await db
        .schema("atendimento")
        .from("canais_externos")
        .update({ status_conexao: "conectado", updated_at: new Date().toISOString() })
        .eq("id", canal.id);
      if (updateError) throw updateError;
      return json(200, { ok: true, status: "conectado" }, cors);
    } catch (error) {
      await db
        .schema("atendimento")
        .from("canais_externos")
        .update({ status_conexao: "erro", updated_at: new Date().toISOString() })
        .eq("id", canal.id);
      throw error;
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 422 : 502;
    return json(status, { ok: false, detail: error instanceof Error ? error.message : "Erro Meta" }, cors);
  }
});

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
