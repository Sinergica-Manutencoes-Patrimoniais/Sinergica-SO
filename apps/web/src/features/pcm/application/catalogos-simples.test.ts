import { describe, expect, it, vi } from "vitest";
import {
  criarCatalogoSimples,
  editarCatalogoSimples,
  excluirCatalogoSimples,
} from "./catalogos-simples";
import type { CatalogosSimplesGateway } from "./catalogos-simples-gateway";

function gatewayMock(): CatalogosSimplesGateway {
  return {
    listar: vi.fn(),
    criar: vi.fn(async (input) => ({
      id: "item-1",
      descricao: input.descricao,
      auvoId: null,
      auvoSyncStatus: "pending",
      auvoSyncError: null,
      auvoSyncedAt: null,
    })),
    editar: vi.fn(async (input) => ({
      id: input.id,
      descricao: input.descricao,
      auvoId: null,
      auvoSyncStatus: "pending",
      auvoSyncError: null,
      auvoSyncedAt: null,
    })),
    excluir: vi.fn(async () => undefined),
  };
}

describe("catalogos-simples use cases", () => {
  it("criar valida descrição e preserva tipo", async () => {
    const gateway = gatewayMock();
    await criarCatalogoSimples(gateway, {
      tipo: "segmentos",
      descricao: "  Condomínio  ",
      userId: "user-1",
    });
    expect(gateway.criar).toHaveBeenCalledWith({
      tipo: "segmentos",
      descricao: "Condomínio",
      userId: "user-1",
    });
  });

  it("editar preserva id", async () => {
    const gateway = gatewayMock();
    await editarCatalogoSimples(gateway, {
      tipo: "palavras_chave",
      id: "kw-1",
      descricao: "SPDA",
      userId: "user-1",
    });
    expect(gateway.editar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "palavras_chave", id: "kw-1", descricao: "SPDA" }),
    );
  });

  it("excluir exige id", () => {
    const gateway = gatewayMock();
    expect(() =>
      excluirCatalogoSimples(gateway, { tipo: "segmentos", id: "", userId: "user-1" }),
    ).toThrow("Registro é obrigatório.");
  });
});
