// Configuração de ambiente tipada e validada na inicialização (fail-fast).
// Regra de segurança: só chaves VITE_* vão ao client. Segredos ficam no servidor.
// Ver seguranca/baseline-minimo.md.

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Públicas (podem ir ao client via Vite) ---
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),

  // --- Servidor apenas (Edge Functions / scripts) — NUNCA no client ---
  // Supabase
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Evolution API (WhatsApp)
  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().min(1).optional(),
  EVOLUTION_HMAC_SECRET: z.string().min(32).optional(),
  // OpenRouter (LLM — Gemini p/ Zé, Claude p/ laudo/proposta)
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_ZE_MODEL: z.string().min(1).optional(),
  ZE_SYSTEM_USER_ID: z.string().uuid().optional(),
  // Auvo (app de campo)
  AUVO_API_KEY: z.string().min(1).optional(),
  AUVO_USER_TOKEN: z.string().min(1).optional(),
  // CORS
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

/**
 * Valida e retorna o env. Chame uma vez no boot (server) e exporte o resultado.
 * Lança erro legível listando o que falta — não silencie.
 */
export function carregarEnv(fonte: Record<string, string | undefined> = process.env): Env {
  const r = schema.safeParse(fonte);
  if (!r.success) {
    const problemas = r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuração de ambiente inválida:\n${problemas}`);
  }
  return r.data;
}
