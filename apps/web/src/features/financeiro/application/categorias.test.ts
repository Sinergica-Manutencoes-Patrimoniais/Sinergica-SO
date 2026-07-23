import { describe, expect, it, vi } from "vitest";
import type { CategoriaItem } from "../domain/categoria";
import { criarCategoria, editarCategoria } from "./categorias";
import { criarFinanceiroGatewayFake as gatewayFake } from "./financeiro-gateway.fake";

const raiz: CategoriaItem = {
  id: "raiz-1",
  nome: "Operação",
  tipo: "saida",
  parentId: null,
  ativo: true,
  seed: true,
};

describe("criarCategoria", () => {
  it("busca categorias existentes antes de validar profundidade", async () => {
    const gateway = gatewayFake({ listarCategorias: vi.fn().mockResolvedValue([raiz]) });
    await criarCategoria(gateway, {
      nome: "Peças",
      tipo: "saida",
      parentId: "raiz-1",
      userId: "user-1",
    });
    expect(gateway.listarCategorias).toHaveBeenCalledOnce();
    expect(gateway.criarCategoria).toHaveBeenCalledWith({
      nome: "Peças",
      tipo: "saida",
      parentId: "raiz-1",
      userId: "user-1",
    });
  });

  it("propaga erro de validação sem chamar criar", async () => {
    const gateway = gatewayFake();
    await expect(
      criarCategoria(gateway, { nome: "", tipo: "saida", userId: "user-1" }),
    ).rejects.toThrow("Nome é obrigatório.");
    expect(gateway.criarCategoria).not.toHaveBeenCalled();
  });
});

describe("editarCategoria", () => {
  it("exclui a própria categoria da lista usada para validar profundidade", async () => {
    const gateway = gatewayFake({ listarCategorias: vi.fn().mockResolvedValue([raiz]) });
    await editarCategoria(gateway, {
      id: "raiz-1",
      nome: "Operação renomeada",
      tipo: "saida",
      userId: "user-1",
    });
    expect(gateway.editarCategoria).toHaveBeenCalledWith({
      nome: "Operação renomeada",
      tipo: "saida",
      parentId: null,
      id: "raiz-1",
      userId: "user-1",
    });
  });
});
