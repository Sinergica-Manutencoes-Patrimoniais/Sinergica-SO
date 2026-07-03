import { describe, expect, it, vi } from "vitest";
import type { ConfigGateway, CriarUsuarioInput } from "./config-gateway";
import { criarUsuario } from "./criar-usuario";
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

const inputValido: CriarUsuarioInput = {
  email: "ana@sinergica.com.br",
  senha: "senha1234",
  nome: "Ana",
  papel: "colaborador",
  modo: { tipo: "individual", permissoes: [] },
};

describe("criarUsuario", () => {
  it("chama o gateway quando os dados são válidos", async () => {
    const gateway = gatewayMock();
    const resultado = await criarUsuario(gateway, inputValido);
    expect(resultado).toEqual({ userId: "u1" });
    expect(gateway.criarUsuario).toHaveBeenCalledWith(inputValido);
  });

  it("rejeita email vazio sem chamar o gateway", async () => {
    const gateway = gatewayMock();
    await expect(criarUsuario(gateway, { ...inputValido, email: "  " })).rejects.toBeInstanceOf(
      DadosUsuarioInvalidosError,
    );
    expect(gateway.criarUsuario).not.toHaveBeenCalled();
  });

  it("rejeita senha com menos de 8 caracteres", async () => {
    const gateway = gatewayMock();
    await expect(criarUsuario(gateway, { ...inputValido, senha: "123" })).rejects.toBeInstanceOf(
      DadosUsuarioInvalidosError,
    );
  });

  it("rejeita nome vazio", async () => {
    const gateway = gatewayMock();
    await expect(criarUsuario(gateway, { ...inputValido, nome: " " })).rejects.toBeInstanceOf(
      DadosUsuarioInvalidosError,
    );
  });

  it("rejeita modo grupo sem grupoId", async () => {
    const gateway = gatewayMock();
    await expect(
      criarUsuario(gateway, { ...inputValido, modo: { tipo: "grupo", grupoId: "" } }),
    ).rejects.toBeInstanceOf(DadosUsuarioInvalidosError);
  });

  it("aceita modo grupo com grupoId válido", async () => {
    const gateway = gatewayMock();
    await criarUsuario(gateway, { ...inputValido, modo: { tipo: "grupo", grupoId: "g1" } });
    expect(gateway.criarUsuario).toHaveBeenCalledOnce();
  });
});
