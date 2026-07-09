// pcm-auvo-users-create — criação segura de usuário Auvo a partir do PCM.
// Exceção deliberada ao outbox genérico: `/users` exige `password`, mas E01-S28 proíbe persistir
// senha. Esta função recebe a senha em memória, chama o Auvo e insere `pcm.funcionarios` via RPC
// com anti-loop, sem gravar a senha no banco nem em logs.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSupabaseServiceKey, HttpError, requireAuth } from "../_shared/auth.ts";
import { AuvoApiError, auvoPost } from "../_shared/auvo/client.ts";

const FN = "pcm-auvo-users-create";

interface Input {
  nome?: string;
  login?: string;
  password?: string;
  culture?: string;
  userType?: number;
  equipe?: string | null;
  cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
}

interface AuvoCreateResponse {
  result?: { id?: number; userID?: number };
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
    const criado = await auvoPost<AuvoCreateResponse>("/users", {
      name: input.nome,
      login: input.login,
      password: input.password,
      culture: input.culture,
      userType: input.userType,
      jobPosition: input.cargo,
      // Confirmado contra a doc oficial da API (2026-07-08): o campo chama-se `smartPhoneNumber`,
      // não `phoneNumber` — chave errada fazia o Auvo nunca receber o telefone e rejeitar a
      // criação (campo obrigatório), o que aparecia pro usuário como "erro de edge function"
      // genérico.
      smartPhoneNumber: input.telefone,
      email: input.email,
    });
    const auvoId = criado.result?.id ?? criado.result?.userID;
    if (auvoId == null) throw new HttpError(502, "Auvo criou usuário sem id na resposta");

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = getSupabaseServiceKey();
    if (!url || !serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: funcionarioId, error } = await db.schema("pcm").rpc("fn_insert_funcionario_auvo_sync", {
      p_auvo_id: auvoId,
      p_nome: input.nome,
      p_equipe: input.equipe,
      p_cargo: input.cargo,
      p_telefone: input.telefone,
      p_email: input.email,
      p_culture: input.culture,
      p_user_type: input.userType,
      p_user_id: userId,
    });
    if (error) throw error;

    return json(201, { id: funcionarioId, auvoId }, cors);
  } catch (e) {
    if (e instanceof HttpError) return problem(e.status, e.message, reqId, cors);
    if (e instanceof AuvoApiError) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "falha Auvo", status: e.status, requestId: e.requestId }));
      return problem(502, "Auvo indisponível ou erro ao criar funcionário", reqId, cors);
    }
    console.error(JSON.stringify({ ts: new Date().toISOString(), nivel: "error", fn: FN, reqId, msg: "erro inesperado", detail: String(e) }));
    return problem(500, "Erro interno", reqId, cors);
  }
});

function validar(raw: unknown): Required<Input> {
  const input = raw as Input;
  const nome = texto(input.nome);
  const login = texto(input.login);
  const password = texto(input.password);
  const culture = texto(input.culture) || "pt-BR";
  const userType = input.userType ?? 1;
  const cargo = texto(input.cargo);
  const telefone = texto(input.telefone);
  const email = texto(input.email);
  if (!nome) throw new HttpError(400, "Nome é obrigatório");
  if (!login) throw new HttpError(400, "Login é obrigatório");
  if (!password || password.length > 14) throw new HttpError(400, "Senha é obrigatória e deve ter até 14 caracteres");
  if (![1, 2, 3].includes(userType)) throw new HttpError(400, "Tipo de usuário inválido");
  // cargo/telefone/email são obrigatórios na criação (`jobPosition`/`smartPhoneNumber`/`email`) na
  // doc oficial da API Auvo — sem eles o Auvo rejeitava e o erro chegava genérico na UI.
  if (!cargo) throw new HttpError(400, "Cargo é obrigatório (exigido pelo Auvo)");
  if (!telefone) throw new HttpError(400, "Telefone é obrigatório (exigido pelo Auvo)");
  if (!email) throw new HttpError(400, "E-mail é obrigatório (exigido pelo Auvo)");
  return {
    nome,
    login,
    password,
    culture,
    userType,
    equipe: texto(input.equipe),
    cargo,
    telefone,
    email,
  };
}

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
