import { describe, expect, it, vi } from "vitest";
import type { ConfigGateway } from "./config-gateway";
import { criarGrupo } from "./criar-grupo";
import { NomeGrupoObrigatorioError } from "./errors";

function gatewayMock(overrides: Partial<ConfigGateway> = {}): ConfigGateway {
  return {
    minhasPermissoes: vi.fn(async () => []),
    listarGrupos: vi.fn(async () => []),
    criarGrupo: vi.fn(async (nome, descricao, permissoes) => ({
      id: "g1",
      nome,
      descricao,
      ativo: true,
      permissoes,
    })),
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

describe("criarGrupo", () => {
  it("cria o grupo com nome/descrição normalizados", async () => {
    const gateway = gatewayMock();
    const permissoes = [{ modulo: "pcm", nivel: "leitura" }] as const;
    const grupo = await criarGrupo(gateway, "  Financeiro RO  ", "  só leitura  ", [...permissoes]);
    expect(gateway.criarGrupo).toHaveBeenCalledWith("Financeiro RO", "só leitura", [...permissoes]);
    expect(grupo.nome).toBe("Financeiro RO");
  });

  it("normaliza descrição vazia para null", async () => {
    const gateway = gatewayMock();
    await criarGrupo(gateway, "Financeiro RO", "   ", []);
    expect(gateway.criarGrupo).toHaveBeenCalledWith("Financeiro RO", null, []);
  });

  it("lança NomeGrupoObrigatorioError quando o nome está vazio", async () => {
    const gateway = gatewayMock();
    await expect(criarGrupo(gateway, "   ", null, [])).rejects.toBeInstanceOf(
      NomeGrupoObrigatorioError,
    );
    expect(gateway.criarGrupo).not.toHaveBeenCalled();
  });
});
