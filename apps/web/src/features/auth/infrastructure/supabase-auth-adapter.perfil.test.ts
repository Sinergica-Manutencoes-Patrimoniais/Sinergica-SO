import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resultado: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: {
    auth: {},
    schema: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: mocks.resultado }) }),
      }),
    }),
  },
}));

import { supabaseAuthAdapter } from "./supabase-auth-adapter";

it("não confunde falha de consulta com perfil inexistente", async () => {
  mocks.resultado.mockResolvedValueOnce({ data: null, error: { code: "401" } });
  await expect(supabaseAuthAdapter.getPerfil("usuario")).rejects.toThrow(
    "Não foi possível consultar o perfil. Tente novamente.",
  );
});

it("retorna perfil ausente apenas quando consulta tem sucesso sem registro", async () => {
  mocks.resultado.mockResolvedValueOnce({ data: null, error: null });
  await expect(supabaseAuthAdapter.getPerfil("usuario")).resolves.toBeNull();
});
