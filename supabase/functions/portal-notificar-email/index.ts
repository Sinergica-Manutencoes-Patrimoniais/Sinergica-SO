// portal-notificar-email — E09-S08. Chamada interna assíncrona por pg_net após criação de
// notificação. Sem Resend/config ativa, degrada para in-app e informa `sent:false`.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireServiceRole } from "../_shared/auth.ts";
import { enviarEmailResend } from "../_shared/resend.ts";

const InputSchema = z.object({ notificacaoId: z.string().uuid() });

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");
    requireServiceRole(req);
    const { notificacaoId } = InputSchema.parse(await req.json());
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: notificacao, error } = await db
      .schema("pcm")
      .from("portal_notificacoes")
      .select("cliente_id,titulo,mensagem")
      .eq("id", notificacaoId)
      .maybeSingle();
    if (error) throw error;
    if (!notificacao) throw new HttpError(404, "Notificação não encontrada");

    const { data: vinculo, error: vinculoError } = await db
      .schema("config")
      .from("usuario_cliente")
      .select("user_id")
      .eq("cliente_id", notificacao.cliente_id)
      .maybeSingle();
    if (vinculoError) throw vinculoError;
    if (!vinculo) return resposta(200, { sent: false, skippedReason: "cliente sem acesso ao portal" }, cors);

    const { data: authData, error: authError } = await db.auth.admin.getUserById(vinculo.user_id);
    if (authError) throw authError;
    const email = authData.user?.email;
    if (!email) return resposta(200, { sent: false, skippedReason: "usuário sem e-mail" }, cors);

    const resultado = await enviarEmailResend(db, {
      to: email,
      subject: notificacao.titulo,
      html: `<p>${escaparHtml(notificacao.mensagem).replaceAll("\n", "<br>")}</p>`,
    });
    return resposta(200, resultado, cors);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : e instanceof z.ZodError ? 422 : 500;
    const detalhe = e instanceof HttpError ? e.message : status === 422 ? "Input inválido" : "Erro interno";
    if (status === 500) console.error(JSON.stringify({ nivel: "error", fn: "portal-notificar-email", msg: "erro inesperado" }));
    return resposta(status, { error: detalhe }, cors);
  }
});

function escaparHtml(valor: string): string {
  return valor.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function resposta(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}
