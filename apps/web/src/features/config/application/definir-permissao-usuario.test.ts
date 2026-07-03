import { describe, expect, it, vi } from "vitest";
import type { ConfigGateway } from "./config-gateway";
import { definirPermissaoUsuario } from "./definir-permissao-usuario";
import { DadosUsuarioInvalidosError } from "./errors";

function gatewayMock(overrides: Partial<ConfigGateway> = {}): ConfigGateway {
  return {
    minhasPermissoes: vi.fn(async () => []),
    listarGrupos: vi.fn(async () => []),
    criarGrupo: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    editarGrupo: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    listarUsuarios: vi.fn(async () => []),
    criarUsuario: vi.fn(async () => ({ userId: "u1" })),
    definirPermissaoUsuario: vi.fn(async () => undefined),
    resolverPermissoesDe: vi.fn(async () => []),
    ...overrides,
  };
}

describe("definirPermissaoUsuario", () => {
  it("repassa modo individual ao gateway", async () => {
    const gateway = gatewayMock();
    const permissoes = [{ modulo: "pcm", nivel: "leitura" }] as const;
    await definirPermissaoUsuario(gateway, "u1", {
      tipo: "individual",
      permissoes: [...permissoes],
    });
    expect(gateway.definirPermissaoUsuario).toHaveBeenCalledWith("u1", {
      tipo: "individual",
      permissoes: [...permissoes],
    });
  });

  it("repassa modo grupo ao gateway", async () => {
    const gateway = gatewayMock();
    await definirPermissaoUsuario(gateway, "u1", { tipo: "grupo", grupoId: "g1" });
    expect(gateway.definirPermissaoUsuario).toHaveBeenCalledWith("u1", {
      tipo: "grupo",
      grupoId: "g1",
    });
  });

  it("rejeita userId vazio", async () => {
    const gateway = gatewayMock();
    await expect(
      definirPermissaoUsuario(gateway, "", { tipo: "individual", permissoes: [] }),
    ).rejects.toBeInstanceOf(DadosUsuarioInvalidosError);
    expect(gateway.definirPermissaoUsuario).not.toHaveBeenCalled();
  });

  it("rejeita modo grupo sem grupoId", async () => {
    const gateway = gatewayMock();
    await expect(
      definirPermissaoUsuario(gateway, "u1", { tipo: "grupo", grupoId: "" }),
    ).rejects.toBeInstanceOf(DadosUsuarioInvalidosError);
  });
});
