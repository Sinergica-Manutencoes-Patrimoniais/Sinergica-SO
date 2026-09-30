import { describe, expect, it, vi } from "vitest";
import type { EquipamentoItem } from "../domain/equipamentos";
import { atualizarPosicaoComponente, criarEquipamento } from "./equipamentos";
import type { EquipamentosGateway } from "./equipamentos-gateway";

function gatewayFake(): EquipamentosGateway {
  return {
    listar: vi.fn(),
    listarClientes: vi.fn(),
    criar: vi.fn(async () => ({}) as EquipamentoItem),
    editar: vi.fn(async () => ({}) as EquipamentoItem),
    desativar: vi.fn(),
    possuiOsAberta: vi.fn(),
    obterItem: vi.fn(async () => null),
    obterContextoItem: vi.fn(),
    atualizarPosicao: vi.fn(),
  };
}

describe("criarEquipamento", () => {
  it("E01-S155 AC-5: exige cliente antes de chamar o gateway", async () => {
    const gateway = gatewayFake();
    await expect(criarEquipamento(gateway, { nome: "Bomba", userId: "user-1" })).rejects.toThrow(
      "Cliente é obrigatório.",
    );
    expect(gateway.criar).not.toHaveBeenCalled();
  });
});

describe("atualizarPosicaoComponente — E01-S155", () => {
  it("chama o gateway sem passar por validarEquipamento (item legado sem cliente/categoria)", async () => {
    const gateway = gatewayFake();
    await atualizarPosicaoComponente(gateway, {
      id: "item-1",
      areaId: "area-1",
      localId: null,
      userId: "user-1",
    });
    expect(gateway.atualizarPosicao).toHaveBeenCalledWith({
      id: "item-1",
      areaId: "area-1",
      localId: null,
      userId: "user-1",
    });
  });

  it("exige id", async () => {
    const gateway = gatewayFake();
    await expect(
      atualizarPosicaoComponente(gateway, {
        id: "",
        areaId: null,
        localId: null,
        userId: "user-1",
      }),
    ).rejects.toThrow("Componente é obrigatório.");
    expect(gateway.atualizarPosicao).not.toHaveBeenCalled();
  });
});
