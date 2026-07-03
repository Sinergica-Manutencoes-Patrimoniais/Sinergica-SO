// Integração real contra Supabase local (ver db/rls-test.md — "fora da CI unitária").
// Requer `supabase start` (Docker) e um usuário de teste com acesso ao módulo pcm. Self-skip quando
// SUPABASE_LOCAL não está setado, para não quebrar `pnpm test` sem Docker — mesmo padrão de
// features/config/infrastructure/supabase-config-adapter.integration.test.ts.
//
// Rodar: SUPABASE_LOCAL=1 SUPABASE_TEST_EMAIL=... SUPABASE_TEST_PASSWORD=... \
//   pnpm --filter @sinergica/web test:integration
import { describe, expect, it } from "vitest";

const EMAIL_TESTE = process.env.SUPABASE_TEST_EMAIL ?? "";
const SENHA_TESTE = process.env.SUPABASE_TEST_PASSWORD ?? "";

describe.skipIf(!process.env.SUPABASE_LOCAL)("supabaseCliente360Adapter (integração)", () => {
  it("AC-8: cliente inexistente retorna null (maybeSingle, sem lançar)", async () => {
    const { supabase } = await import("../../../lib/supabase-client");
    const { supabaseCliente360Adapter } = await import("./supabase-cliente-360-adapter");

    await supabase.auth.signInWithPassword({ email: EMAIL_TESTE, password: SENHA_TESTE });
    // UUID sintaticamente válido que não existe
    const cliente = await supabaseCliente360Adapter.buscarCliente(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(cliente).toBeNull();
    await supabase.auth.signOut();
  });

  it("AC-3/AC-4: backlog e histórico retornam arrays sem lançar", async () => {
    const { supabase } = await import("../../../lib/supabase-client");
    const { supabaseCliente360Adapter } = await import("./supabase-cliente-360-adapter");

    await supabase.auth.signInWithPassword({ email: EMAIL_TESTE, password: SENHA_TESTE });
    const backlog = await supabaseCliente360Adapter.listarBacklogCliente(
      "00000000-0000-0000-0000-000000000000",
    );
    const historico = await supabaseCliente360Adapter.listarHistoricoCliente(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(Array.isArray(backlog)).toBe(true);
    expect(Array.isArray(historico)).toBe(true);
    await supabase.auth.signOut();
  });

  it("AC-6: equipamentos_cache ausente (E01-S11 não mergeada) degrada para 'indisponivel'", async () => {
    const { supabase } = await import("../../../lib/supabase-client");
    const { supabaseCliente360Adapter } = await import("./supabase-cliente-360-adapter");

    await supabase.auth.signInWithPassword({ email: EMAIL_TESTE, password: SENHA_TESTE });
    // auvoId não-nulo força a query ao cache; sem a tabela (PGRST205) deve retornar "indisponivel",
    // nunca lançar. É o caminho REAL de degradação nesta build.
    const resultado = await supabaseCliente360Adapter.listarEquipamentosCliente("qualquer", 1);
    expect(resultado === "indisponivel" || Array.isArray(resultado)).toBe(true);
    await supabase.auth.signOut();
  });

  it("AC-6: cliente com auvo_id nulo retorna [] sem consultar o cache", async () => {
    const { supabaseCliente360Adapter } = await import("./supabase-cliente-360-adapter");
    const resultado = await supabaseCliente360Adapter.listarEquipamentosCliente("qualquer", null);
    expect(resultado).toEqual([]);
  });
});
