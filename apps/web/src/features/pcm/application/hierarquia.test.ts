import { describe, expect, it, vi } from "vitest";
import { criarLocal, desativarLocal, moverLocal } from "./hierarquia";
import type { HierarquiaGateway } from "./hierarquia-gateway";

function gatewayStub(overrides: Partial<HierarquiaGateway> = {}): HierarquiaGateway {
  return {
    listarAreas: vi.fn(async () => []),
    criarArea: vi.fn(),
    editarArea: vi.fn(),
    desativarArea: vi.fn(),
    listarLocais: vi.fn(async () => []),
    listarLocaisDoCliente: vi.fn(async () => []),
    criarLocal: vi.fn(async (input) => ({
      id: "novo-local",
      ...input,
      tipoNome: null,
      ativo: true,
    })),
    editarLocal: vi.fn(),
    moverLocal: vi.fn(async (id, parentId) => ({
      id,
      areaId: "a1",
      parentId,
      nome: "x",
      tipoId: null,
      tipoNome: null,
      descricao: null,
      ordem: 0,
      ativo: true,
    })),
    desativarLocal: vi.fn(),
    possuiItensInstalados: vi.fn(async () => false),
    listarTiposDeLocal: vi.fn(async () => []),
    criarTipoDeLocal: vi.fn(),
    desativarTipoDeLocal: vi.fn(),
    ...overrides,
  };
}

describe("application/hierarquia — desativarLocal", () => {
  it("bloqueia desativar Local com Itens instalados (edge case do spec)", async () => {
    const gateway = gatewayStub({ possuiItensInstalados: vi.fn(async () => true) });
    await expect(desativarLocal(gateway, "l1", "user-1")).rejects.toThrow(
      "Este Local tem Itens instalados. Remova ou realoque os Itens primeiro.",
    );
    expect(gateway.desativarLocal).not.toHaveBeenCalled();
  });

  it("desativa Local sem Itens instalados", async () => {
    const gateway = gatewayStub();
    await desativarLocal(gateway, "l1", "user-1");
    expect(gateway.desativarLocal).toHaveBeenCalledWith("l1", "user-1");
  });
});

describe("application/hierarquia — criarLocal (INV-2)", () => {
  it("rejeita parent_id de Local de outra Área", async () => {
    const gateway = gatewayStub({
      listarLocais: vi.fn(async () => [
        {
          id: "pai",
          areaId: "outra-area",
          parentId: null,
          nome: "x",
          tipoId: null,
          tipoNome: null,
          descricao: null,
          ordem: 0,
          ativo: true,
        },
      ]),
    });
    await expect(
      criarLocal(gateway, { areaId: "a1", parentId: "pai", nome: "Sala", userId: "user-1" }),
    ).rejects.toThrow("Local pai deve pertencer à mesma Área.");
  });
});

describe("application/hierarquia — moverLocal (INV-1/INV-2)", () => {
  it("rejeita mover Local pra baixo de si mesmo (ciclo)", async () => {
    const gateway = gatewayStub({
      listarLocais: vi.fn(async () => [
        {
          id: "l1",
          areaId: "a1",
          parentId: null,
          nome: "3º andar",
          tipoId: null,
          tipoNome: null,
          descricao: null,
          ordem: 0,
          ativo: true,
        },
        {
          id: "l2",
          areaId: "a1",
          parentId: "l1",
          nome: "Sala 302",
          tipoId: null,
          tipoNome: null,
          descricao: null,
          ordem: 0,
          ativo: true,
        },
      ]),
    });
    await expect(moverLocal(gateway, "l1", "a1", "l2", "user-1")).rejects.toThrow(
      "Ciclo de Local detectado.",
    );
  });
});
