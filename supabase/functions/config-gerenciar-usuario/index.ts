// config-gerenciar-usuario — cria usuário Auth + perfil + permissões iniciais.
// A regra de autorização fina fica no banco; esta borda valida o chamador e coordena o fluxo.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";

const FN = "config-gerenciar-usuario";

const PapelSchema = z.enum(["superadmin", "supervisor", "colaborador", "cliente-sindico"]);
const ModuloSchema = z.enum([
  "pcm",
  "atendimento",
  "comercial",
  "financeiro",
  "operacao",
  "marketing",
  "growth",
  "gestao",
  "area-cliente",
]);
const NivelSchema = z.enum(["leitura", "escrita"]);

const ModoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("grupo"),
    grupoId: z.string().uuid(),
  }),
  z.object({
    tipo: z.literal("individual"),
    permissoes: z.record(ModuloSchema, NivelSchema).default({}),
  }),
]);

const InputSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8),
  nome: z.string().min(1),
  papel: PapelSchema,
  modo: ModoSchema,
});

serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });

  const reqId = crypto.randomUUID().slice(0, 8);
  console.log(JSON.stringify({ ts: new Date().toISOString(), nivel: "info", fn: FN, reqId, method: req.method }));

  try {
    if (req.method !== "POST") throw new HttpError(405, "Método não permitido");

    const { userId } = await requireAuth(req);
    const input = InputSchema.parse(await req.json());

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = getSupabaseServiceKey();

    if (!url || !anonKey || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: perfil, error: perfilError } = await userClient
      .schema("config")
      .from("usuarios")
      .select("papel, ativo")
      .eq("user_id", userId)
      .maybeSingle();

    if (perfilError) throw perfilError;
    if (!perfil?.ativo || !["superadmin", "supervisor"].includes(perfil.papel)) {
      throw new HttpError(403, "Sem permissão para gerenciar usuários");
    }
    if (perfil.papel === "supervisor" && input.papel === "superadmin") {
      throw new HttpError(403, "Supervisor não pode criar superadmin");
    }

    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: input.email,
      password: input.senha,
      email_confirm: true,
    });
    if (authError || !authData.user) throw authError ?? badRequest("Usuário Auth não criado");

    const createdUserId = authData.user.id;
    try {
      const { error: perfilCreateError } = await serviceClient
        .schema("config")
        .rpc("provisionar_usuario", {
          p_user_id: createdUserId,
          p_papel: input.papel,
          p_nome: input.nome,
        });
      if (perfilCreateError) throw perfilCreateError;

      const { error: permissaoError } = await serviceClient
        .schema("config")
        .rpc("definir_permissao_usuario", {
          p_user_id: createdUserId,
          p_grupo_id: input.modo.tipo === "grupo" ? input.modo.grupoId : null,
          p_permissoes: input.modo.tipo === "individual" ? input.modo.permissoes : null,
        });
      if (permissaoError) throw permissaoError;
    } catch (e) {
      await serviceClient.auth.admin.deleteUser(createdUserId);
      throw e;
    }

    return json(201, { userId: createdUserId }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof z.ZodError) return problem(422, "Input inválido", reqId, cors);
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado" }));
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
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    405: "Method Not Allowed",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
  };
  const body = { type: "about:blank", title: titles[status] ?? "Error", status, detail, reqId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json", ...cors },
  });
}
