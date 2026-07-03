// Integração real contra Supabase local (ver db/rls-test.md — "fora da CI unitária").
// Requer `supabase start` (Docker) rodando e um usuário de teste superadmin/supervisor
// provisionado (ver runbooks/provisionar-usuario.md). Self-skip quando SUPABASE_LOCAL não está
// setado, para não quebrar `pnpm test` em ambiente sem Docker — mesmo padrão de
// features/auth/infrastructure/supabase-auth-adapter.integration.test.ts.
//
// Rodar: SUPABASE_LOCAL=1 SUPABASE_TEST_EMAIL=... SUPABASE_TEST_PASSWORD=... \
//   pnpm --filter @sinergica/web test:integration
import { describe, expect, it } from "vitest";

const EMAIL_TESTE = process.env.SUPABASE_TEST_EMAIL ?? "";
const SENHA_TESTE = process.env.SUPABASE_TEST_PASSWORD ?? "";

describe.skipIf(!process.env.SUPABASE_LOCAL)("supabaseConfigAdapter (integração)", () => {
  it("resolve as próprias permissões após login (AC-4)", async () => {
    const { supabase } = await import("../../../lib/supabase-client");
    const { supabaseConfigAdapter } = await import("./supabase-config-adapter");

    await supabase.auth.signInWithPassword({ email: EMAIL_TESTE, password: SENHA_TESTE });
    const permissoes = await supabaseConfigAdapter.minhasPermissoes();
    expect(Array.isArray(permissoes)).toBe(true);
    await supabase.auth.signOut();
  });

  it("lista grupos quando logado como superadmin/supervisor (AC-2)", async () => {
    const { supabase } = await import("../../../lib/supabase-client");
    const { supabaseConfigAdapter } = await import("./supabase-config-adapter");

    await supabase.auth.signInWithPassword({ email: EMAIL_TESTE, password: SENHA_TESTE });
    const grupos = await supabaseConfigAdapter.listarGrupos();
    expect(Array.isArray(grupos)).toBe(true);
    await supabase.auth.signOut();
  });
});
