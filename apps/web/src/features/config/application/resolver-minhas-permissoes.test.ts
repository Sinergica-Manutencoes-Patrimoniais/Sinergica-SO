import { describe, expect, it, vi } from "vitest";
import type { PermissaoModulo } from "../domain/grupo";
import type { ConfigGateway } from "./config-gateway";
import { resolverMinhasPermissoes } from "./resolver-minhas-permissoes";

function gatewayMock(overrides: Partial<ConfigGateway> = {}): ConfigGateway {
  return {
    minhasPermissoes: vi.fn(
      async (): Promise<PermissaoModulo[]> => [{ modulo: "pcm", nivel: "leitura" }],
    ),
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

describe("resolverMinhasPermissoes", () => {
  it("repassa as permissões resolvidas pelo gateway", async () => {
    const gateway = gatewayMock();
    expect(await resolverMinhasPermissoes(gateway)).toEqual([{ modulo: "pcm", nivel: "leitura" }]);
  });

  it("retorna lista vazia quando o gateway não resolve nenhuma permissão", async () => {
    const gateway = gatewayMock({ minhasPermissoes: vi.fn(async () => []) });
    expect(await resolverMinhasPermissoes(gateway)).toEqual([]);
  });
});
