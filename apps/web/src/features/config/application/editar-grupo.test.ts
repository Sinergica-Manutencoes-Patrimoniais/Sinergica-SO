import { describe, expect, it, vi } from "vitest";
import type { ConfigGateway } from "./config-gateway";
import { editarGrupo } from "./editar-grupo";
import { NomeGrupoObrigatorioError } from "./errors";

function gatewayMock(overrides: Partial<ConfigGateway> = {}): ConfigGateway {
  return {
    minhasPermissoes: vi.fn(async () => []),
    listarGrupos: vi.fn(async () => []),
    criarGrupo: vi.fn(async () => {
      throw new Error("not implemented");
    }),
    editarGrupo: vi.fn(async (id, patch) => ({
      id,
      nome: patch.nome ?? "Financeiro RO",
      descricao: patch.descricao ?? null,
      ativo: patch.ativo ?? true,
      permissoes: patch.permissoes ?? [],
    })),
    listarUsuarios: vi.fn(async () => []),
    criarUsuario: vi.fn(async () => ({ userId: "u1" })),
    definirPermissaoUsuario: vi.fn(async () => undefined),
    resolverPermissoesDe: vi.fn(async () => []),
    ...overrides,
  };
}

describe("editarGrupo", () => {
  it("repassa o patch normalizado ao gateway", async () => {
    const gateway = gatewayMock();
    await editarGrupo(gateway, "g1", { nome: "  Novo nome  ", descricao: "  " });
    expect(gateway.editarGrupo).toHaveBeenCalledWith("g1", { nome: "Novo nome", descricao: null });
  });

  it("permite patch parcial (só ativo)", async () => {
    const gateway = gatewayMock();
    await editarGrupo(gateway, "g1", { ativo: false });
    expect(gateway.editarGrupo).toHaveBeenCalledWith("g1", { ativo: false });
  });

  it("lança NomeGrupoObrigatorioError quando nome é enviado vazio", async () => {
    const gateway = gatewayMock();
    await expect(editarGrupo(gateway, "g1", { nome: "   " })).rejects.toBeInstanceOf(
      NomeGrupoObrigatorioError,
    );
    expect(gateway.editarGrupo).not.toHaveBeenCalled();
  });
});
