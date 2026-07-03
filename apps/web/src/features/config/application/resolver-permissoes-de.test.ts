import { describe, expect, it, vi } from "vitest";
import type { PermissaoModulo } from "../domain/grupo";
import type { ConfigGateway } from "./config-gateway";
import { resolverPermissoesDe } from "./resolver-permissoes-de";

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
    resolverPermissoesDe: vi.fn(
      async (): Promise<PermissaoModulo[]> => [{ modulo: "financeiro", nivel: "escrita" }],
    ),
    ...overrides,
  };
}

describe("resolverPermissoesDe", () => {
  it("repassa userId ao gateway e devolve as permissões resolvidas", async () => {
    const gateway = gatewayMock();
    const permissoes = await resolverPermissoesDe(gateway, "u2");
    expect(gateway.resolverPermissoesDe).toHaveBeenCalledWith("u2");
    expect(permissoes).toEqual([{ modulo: "financeiro", nivel: "escrita" }]);
  });
});
