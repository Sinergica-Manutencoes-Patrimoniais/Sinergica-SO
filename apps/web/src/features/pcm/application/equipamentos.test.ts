import { describe, expect, it, vi } from "vitest";
import type { EquipamentoItem } from "../domain/equipamentos";
import { atualizarPosicaoComponente, criarEquipamento, editarEquipamento } from "./equipamentos";
import type { EquipamentosGateway } from "./equipamentos-gateway";
import { IdentificadorDuplicadoError } from "./identificador-ativo";
import type { IdentificadorAtivoGateway } from "./identificador-ativo-gateway";

function gatewayFake(): EquipamentosGateway {
  return {
    listar: vi.fn(),
    listarPorCliente: vi.fn(),
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

  it("E01-S157 AC-6: reserva de novo uma vez ao colidir no sequencial", async () => {
    const gateway = gatewayFake();
    gateway.criar = vi
      .fn()
      .mockRejectedValueOnce(new IdentificadorDuplicadoError("GUA-ELE-BOM-01"))
      .mockResolvedValue({} as EquipamentoItem);
    const identificador: IdentificadorAtivoGateway = {
      obterNiveis: vi.fn(async () => ({
        cliente: { id: "cli-1", nome: "Guainumbí", sigla: "GUA" },
        area: null,
        locais: [],
        categoria: { id: "cat-1", nome: "Elétrica", sigla: "ELE" },
      })),
      definirSigla: vi.fn(),
      proximoSequencial: vi.fn().mockResolvedValueOnce("01").mockResolvedValueOnce("02"),
    };
    await criarEquipamento(
      gateway,
      { nome: "Bomba", categoriaId: "cat-1", clientId: "cli-1", userId: "user-1" },
      { identificador, siglasInformadas: [], identificadorManual: null },
    );
    expect(gateway.criar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ identificador: "GUA-ELE-BOM-01" }),
    );
    expect(gateway.criar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ identificador: "GUA-ELE-BOM-02" }),
    );
  });

  it("E01-S163 AC-3: restaura siglas sugeridas se a criação do componente falhar", async () => {
    const gateway = gatewayFake();
    gateway.criar = vi.fn(async () => {
      throw new Error("falha ao criar componente");
    });
    let siglaCliente: string | null = null;
    const identificador: IdentificadorAtivoGateway = {
      obterNiveis: vi.fn(async () => ({
        cliente: { id: "cli-1", nome: "Guainumbí", sigla: siglaCliente },
        area: null,
        locais: [],
        categoria: { id: "cat-1", nome: "Elétrica", sigla: "ELE" },
      })),
      definirSigla: vi.fn(async (nivel, _id, sigla) => {
        if (nivel === "cliente") siglaCliente = sigla;
      }),
      proximoSequencial: vi.fn().mockResolvedValue("01"),
    };

    await expect(
      criarEquipamento(
        gateway,
        { nome: "Bomba", categoriaId: "cat-1", clientId: "cli-1", userId: "user-1" },
        {
          identificador,
          siglasInformadas: [{ nivel: "cliente", id: "cli-1", sigla: "GUA" }],
          identificadorManual: null,
        },
      ),
    ).rejects.toThrow("falha ao criar componente");

    expect(identificador.definirSigla).toHaveBeenNthCalledWith(
      1,
      "cliente",
      "cli-1",
      "GUA",
      "user-1",
    );
    expect(identificador.definirSigla).toHaveBeenNthCalledWith(
      2,
      "cliente",
      "cli-1",
      null,
      "user-1",
    );
  });
});

describe("editarEquipamento — E01-S163", () => {
  it("persiste siglas aceitas e recalcula o identificador antes de atualizar o ativo", async () => {
    const gateway = gatewayFake();
    const identificador: IdentificadorAtivoGateway = {
      obterNiveis: vi.fn(async () => ({
        cliente: { id: "cli-1", nome: "Guainumbí", sigla: "GUA" },
        area: null,
        locais: [],
        categoria: { id: "cat-1", nome: "Elétrica", sigla: "ELE" },
      })),
      definirSigla: vi.fn(),
      proximoSequencial: vi.fn().mockResolvedValue("01"),
    };

    await editarEquipamento(
      gateway,
      {
        id: "item-1",
        nome: "Bomba",
        categoriaId: "cat-1",
        clientId: "cli-1",
        identificador: "GUA-ELE-BOM-01",
        alterarIdentificador: true,
        identificadorManual: null,
        userId: "user-1",
      },
      {
        identificador,
        siglasInformadas: [{ nivel: "cliente", id: "cli-1", sigla: "GUA" }],
        identificadorManual: null,
      },
    );

    expect(identificador.definirSigla).not.toHaveBeenCalled();
    expect(gateway.editar).toHaveBeenCalledWith(
      expect.objectContaining({ identificador: "GUA-ELE-BOM-01", alterarIdentificador: true }),
    );
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
