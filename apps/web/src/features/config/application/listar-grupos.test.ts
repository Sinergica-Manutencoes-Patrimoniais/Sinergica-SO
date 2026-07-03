import { describe, expect, it, vi } from "vitest";
import type { ConfigGateway } from "./config-gateway";
import { listarGrupos } from "./listar-grupos";

function gatewayMock(overrides: Partial<ConfigGateway> = {}): ConfigGateway {
  return {
    minhasPermissoes: vi.fn(async () => []),
    listarGrupos: vi.fn(async () => [
      { id: "g1", nome: "Financeiro RO", descricao: null, ativo: true, permissoes: [] },
    ]),
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

describe("listarGrupos", () => {
  it("repassa a lista de grupos do gateway", async () => {
    const gateway = gatewayMock();
    expect(await listarGrupos(gateway)).toEqual([
      { id: "g1", nome: "Financeiro RO", descricao: null, ativo: true, permissoes: [] },
    ]);
  });
});
