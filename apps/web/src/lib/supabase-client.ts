// Client único do @supabase/supabase-js — compartilhado por toda a app.
// Não crie outra instância de createClient(): toda feature que precisar de auth ou dados
// reusa este client (ver docs/ARCHITECTURE.md — lib/ é para helpers genéricos cross-feature).
import { createClient } from "@supabase/supabase-js";
import { carregarEnv } from "../config/env";

const env = carregarEnv(import.meta.env as unknown as Record<string, string | undefined>);

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
