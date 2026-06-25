// _shared/auth.ts — autenticação para Edge Functions (Deno). Vale para os dois perfis.
// Toda função que toca dado valida o JWT via auth.getUser(). Ver seguranca/baseline-minimo.md.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = "Não autorizado") => new HttpError(401, msg);
export const badRequest = (msg: string) => new HttpError(400, msg);

/** Valida o Bearer token e retorna o user. Lança HttpError 401 se inválido. */
export async function requireAuth(req: Request): Promise<{ userId: string }> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) throw unauthorized("Token ausente");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw unauthorized("Token inválido");
  return { userId: data.user.id };
}
