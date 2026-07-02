import { describe, expect, it, vi } from "vitest";
import type { AuthGateway } from "./auth-gateway";
import { ContaSemPerfilError, CredenciaisInvalidasError, signIn } from "./sign-in";

function gatewayMock(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signInWithPassword: vi.fn(async () => ({ userId: "u1", email: "a@b.com" })),
    signOut: vi.fn(async () => undefined),
    getSession: vi.fn(async () => null),
    getPerfil: vi.fn(async () => ({ papel: "admin", nome: "Admin Teste" })),
    onAuthStateChange: vi.fn(() => () => undefined),
    ...overrides,
  };
}

describe("signIn", () => {
  it("retorna o usuário autenticado quando credenciais e perfil são válidos", async () => {
    const gateway = gatewayMock();
    const usuario = await signIn(gateway, "a@b.com", "senha123");
    expect(usuario).toEqual({ id: "u1", email: "a@b.com", nome: "Admin Teste", papel: "admin" });
  });

  it("lança CredenciaisInvalidasError sem revelar qual campo está errado", async () => {
    const gateway = gatewayMock({
      signInWithPassword: vi.fn(async () => {
        throw new Error("invalid_grant");
      }),
    });
    await expect(signIn(gateway, "a@b.com", "errada")).rejects.toBeInstanceOf(
      CredenciaisInvalidasError,
    );
  });

  it("lança ContaSemPerfilError e faz signOut quando não há linha em config.usuarios", async () => {
    const gateway = gatewayMock({ getPerfil: vi.fn(async () => null) });
    await expect(signIn(gateway, "a@b.com", "senha123")).rejects.toBeInstanceOf(
      ContaSemPerfilError,
    );
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it("lança ContaSemPerfilError quando o papel salvo é inválido", async () => {
    const gateway = gatewayMock({
      getPerfil: vi.fn(async () => ({ papel: "gerente", nome: "X" })),
    });
    await expect(signIn(gateway, "a@b.com", "senha123")).rejects.toBeInstanceOf(
      ContaSemPerfilError,
    );
  });
});
