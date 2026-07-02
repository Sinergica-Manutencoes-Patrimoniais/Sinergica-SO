import { describe, expect, it, vi } from "vitest";
import type { AuthGateway } from "./auth-gateway";
import { getSession } from "./get-session";

function gatewayMock(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signInWithPassword: vi.fn(async () => ({ userId: "u1", email: "a@b.com" })),
    signOut: vi.fn(async () => undefined),
    getSession: vi.fn(async () => ({ userId: "u1", email: "a@b.com" })),
    getPerfil: vi.fn(async () => ({ papel: "colaborador", nome: "Colaborador Teste" })),
    onAuthStateChange: vi.fn(() => () => undefined),
    ...overrides,
  };
}

describe("getSession", () => {
  it("retorna sem-sessao quando não há sessão ativa", async () => {
    const gateway = gatewayMock({ getSession: vi.fn(async () => null) });
    expect(await getSession(gateway)).toEqual({ status: "sem-sessao" });
  });

  it("retorna sem-perfil quando a sessão existe mas não há linha em config.usuarios", async () => {
    const gateway = gatewayMock({ getPerfil: vi.fn(async () => null) });
    expect(await getSession(gateway)).toEqual({ status: "sem-perfil" });
  });

  it("retorna autenticado com o usuário resolvido quando sessão e perfil existem", async () => {
    const gateway = gatewayMock();
    expect(await getSession(gateway)).toEqual({
      status: "autenticado",
      usuario: { id: "u1", email: "a@b.com", nome: "Colaborador Teste", papel: "colaborador" },
    });
  });
});
