import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Edge Functions acessam schemas não públicos sem tipos gerados. O tipo padrão recente do SDK
// resolve esses schemas como `never`; esta borda mantém o restante do código estritamente tipado.
// deno-lint-ignore no-explicit-any
export type UntypedSupabaseClient = SupabaseClient<any, any, any>;
