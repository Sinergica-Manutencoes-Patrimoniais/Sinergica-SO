// Integração real contra Supabase local (ver db/rls-test.md — "fora da CI unitária").
// Requer `supabase start` (Docker) rodando e um usuário de teste provisionado via
// runbooks/provisionar-usuario.md. Self-skip quando SUPABASE_LOCAL não está setado, para não
// quebrar `pnpm test` em ambiente sem Docker (ver tasks.md, task 11).
//
// Rodar: SUPABASE_LOCAL=1 pnpm --filter @sinergica/web test:integration
import { describe, expect, it } from "vitest";
// Import dinâmico de propósito: o módulo (via supabase-client.ts) valida o env no load e lança
// se VITE_SUPABASE_URL/ANON_KEY não existirem (fail-fast). Import estático quebraria `pnpm test`
// em qualquer ambiente sem esse .env — mesmo com describe.skipIf, o import de topo roda sempre.

const EMAIL_TESTE = process.env.SUPABASE_TEST_EMAIL ?? "";
const SENHA_TESTE = process.env.SUPABASE_TEST_PASSWORD ?? "";

describe.skipIf(!process.env.SUPABASE_LOCAL)("supabaseAuthAdapter (integração)", () => {
  it("autentica com credenciais válidas e resolve o perfil (AC-1)", async () => {
    const { supabaseAuthAdapter } = await import("./supabase-auth-adapter");
    const sessao = await supabaseAuthAdapter.signInWithPassword(EMAIL_TESTE, SENHA_TESTE);
    expect(sessao.userId).toBeTruthy();

    const perfil = await supabaseAuthAdapter.getPerfil(sessao.userId);
    expect(perfil).not.toBeNull();

    await supabaseAuthAdapter.signOut();
  });

  it("rejeita credenciais inválidas (AC-2)", async () => {
    const { supabaseAuthAdapter } = await import("./supabase-auth-adapter");
    await expect(
      supabaseAuthAdapter.signInWithPassword(EMAIL_TESTE, "senha-errada-com-certeza"),
    ).rejects.toThrow();
  });

  it("getSession retorna null após signOut (AC-5, AC-6)", async () => {
    const { supabaseAuthAdapter } = await import("./supabase-auth-adapter");
    await supabaseAuthAdapter.signInWithPassword(EMAIL_TESTE, SENHA_TESTE);
    await supabaseAuthAdapter.signOut();
    expect(await supabaseAuthAdapter.getSession()).toBeNull();
  });
});
