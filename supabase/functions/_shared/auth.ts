// _shared/auth.ts — autenticação para Edge Functions (Deno). Vale para os dois perfis.
// Toda função que toca dado valida o JWT via auth.getUser(). Ver seguranca/baseline-minimo.md.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeEqual } from "./crypto.ts";

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

function getSupabaseSecretKeyValues(): string[] {
  const legacyServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
  const keys = new Set<string>();

  if (legacyServiceKey) keys.add(legacyServiceKey);

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, unknown>;
      for (const value of Object.values(secretKeys)) {
        if (typeof value === "string" && value) keys.add(value);
      }
    } catch {
      // Ignora JSON inválido: a validação abaixo falha fechado se nenhuma chave utilizável existir.
    }
  }

  return [...keys];
}

export function getSupabaseServiceKey(): string {
  const [serviceKey] = getSupabaseSecretKeyValues();
  if (!serviceKey) throw new HttpError(500, "Ambiente Supabase incompleto");
  return serviceKey;
}

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

/**
 * Valida chamada interna sistema→sistema (trigger `pg_net`, ou uma Edge Function chamando outra).
 * Não há usuário final nessas chamadas — `requireAuth`/`auth.getUser()` não se aplica. Em vez
 * disso, exige que o Bearer token seja uma das chaves privilegiadas do próprio projeto
 * (`SUPABASE_SERVICE_ROLE_KEY` ou valores de `SUPABASE_SECRET_KEYS`), comparado em tempo
 * constante (`_shared/crypto.ts`) contra timing attack.
 *
 * Usado pelas Edge Functions de integração Auvo (`pcm-auvo-customers-sync`,
 * `pcm-auvo-create-task`) — nunca expostas ao frontend, só invocadas pelo trigger de banco ou
 * uma pela outra. Ver specs/E01-S09-integracao-auvo-fundacao/design.md (fluxo TRG→EF1→EF2).
 */
export function requireServiceRole(req: Request): void {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const serviceKeys = getSupabaseSecretKeyValues();
  if (!token || serviceKeys.length === 0) throw unauthorized("Chamada interna não autorizada");
  if (!serviceKeys.some((serviceKey) => constantTimeEqual(token, serviceKey))) {
    throw unauthorized("Chamada interna não autorizada");
  }
}
