import { describe, expect, it, vi } from "vitest";
import type { ConfigGateway, UsuarioConfig } from "./config-gateway";
import { listarUsuarios } from "./listar-usuarios";

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
    listarUsuarios: vi.fn(
      async (): Promise<UsuarioConfig[]> => [
        {
          userId: "u1",
          nome: "Ana",
          papel: "colaborador",
          ativo: true,
          modo: { tipo: "individual", permissoes: [] },
        },
      ],
    ),
    criarUsuario: vi.fn(async () => ({ userId: "u1" })),
    definirPermissaoUsuario: vi.fn(async () => undefined),
    resolverPermissoesDe: vi.fn(async () => []),
    ...overrides,
  };
}

describe("listarUsuarios", () => {
  it("repassa a lista de usuários do gateway", async () => {
    const gateway = gatewayMock();
    const usuarios = await listarUsuarios(gateway);
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0]?.nome).toBe("Ana");
  });
});
