import { describe, expect, it, vi } from "vitest";
import { criarContratoPmoc, criarEquipamentoPmoc } from "./pmoc";
import type { PmocGateway } from "./pmoc-gateway";

function gatewayFake(): PmocGateway {
  return {
    listarClientes: vi.fn(),
    listarContratos: vi.fn(),
    obterDetalheContrato: vi.fn(),
    criarContrato: vi.fn(async (input) => ({
      id: "pmoc-1",
      propertyId: "prop-1",
      clientId: input.clientId,
      clienteNome: "Cliente",
      imovelNome: input.imovelNome,
      tipoImovel: input.tipoImovel,
      endereco: input.endereco,
      cidade: input.cidade,
      estado: input.estado,
      contatoNome: input.contatoNome,
      contatoEmail: input.contatoEmail,
      tecnicoNome: input.tecnicoNome,
      crea: input.crea,
      artNumber: input.artNumber,
      artDate: input.artDate,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "ativo" as const,
      totalEquipamentos: input.equipamentos.length,
      visitasMes: 1,
      visitasAtrasadas: 0,
      proximaVisita: input.startDate,
      microbioPendentes: 0,
      ncsAbertas: 0,
    })),
    criarEquipamento: vi.fn(async (input) => ({
      id: "eq-1",
      propertyId: input.propertyId,
      auvoEquipmentId: input.auvoEquipmentId,
      tag: input.tag,
      type: input.type,
      brand: input.brand,
      model: input.model,
      capacityBtu: input.capacityBtu,
      location: input.location,
      environment: input.environment,
      floor: input.floor,
      refrigerant: input.refrigerant,
      phase: input.phase,
      condition: input.condition,
      notes: input.notes,
    })),
  };
}

describe("pmoc application", () => {
  it("normaliza cadastro de contrato antes de persistir", async () => {
    const gateway = gatewayFake();

    await criarContratoPmoc(gateway, {
      clientId: "cliente-1",
      imovelNome: "  Cond. Primavera  ",
      tipoImovel: "residencial",
      endereco: "  Rua 1  ",
      cidade: " Campinas ",
      estado: " SP ",
      cep: null,
      cnpjCpf: null,
      contatoNome: "  Marcos  ",
      contatoCargo: null,
      contatoTelefone: null,
      contatoEmail: " sindico@example.com ",
      tecnicoNome: "  Fabrício Medeiros  ",
      crea: "  CREA  ",
      artNumber: " ART-1 ",
      artDate: null,
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      notes: "  Obs  ",
      equipamentos: [
        { tag: " ac-01 ", type: "split-hiwall", location: " cobertura ", capacityBtu: 12000 },
        { tag: " ", type: "cassete", location: null, capacityBtu: null },
      ],
      createdBy: "user-1",
    });

    expect(gateway.criarContrato).toHaveBeenCalledWith(
      expect.objectContaining({
        imovelNome: "Cond. Primavera",
        endereco: "Rua 1",
        contatoNome: "Marcos",
        contatoEmail: "sindico@example.com",
        tecnicoNome: "Fabrício Medeiros",
        equipamentos: [
          { tag: "AC-01", type: "split-hiwall", location: "cobertura", capacityBtu: 12000 },
        ],
      }),
    );
  });

  it("bloqueia contrato sem cliente", async () => {
    const gateway = gatewayFake();

    await expect(
      criarContratoPmoc(gateway, {
        clientId: "",
        imovelNome: "Condomínio",
        tipoImovel: "residencial",
        endereco: null,
        cidade: null,
        estado: null,
        cep: null,
        cnpjCpf: null,
        contatoNome: null,
        contatoCargo: null,
        contatoTelefone: null,
        contatoEmail: null,
        tecnicoNome: "Fabrício",
        crea: null,
        artNumber: null,
        artDate: null,
        startDate: "2026-07-01",
        endDate: "2027-06-30",
        notes: null,
        equipamentos: [],
        createdBy: "user-1",
      }),
    ).rejects.toThrow("Cliente é obrigatório.");
    expect(gateway.criarContrato).not.toHaveBeenCalled();
  });

  it("bloqueia período inválido", async () => {
    await expect(
      criarContratoPmoc(gatewayFake(), {
        clientId: "cliente-1",
        imovelNome: "Condomínio",
        tipoImovel: "residencial",
        endereco: null,
        cidade: null,
        estado: null,
        cep: null,
        cnpjCpf: null,
        contatoNome: null,
        contatoCargo: null,
        contatoTelefone: null,
        contatoEmail: null,
        tecnicoNome: "Fabrício",
        crea: null,
        artNumber: null,
        artDate: null,
        startDate: "2027-07-01",
        endDate: "2026-06-30",
        notes: null,
        equipamentos: [],
        createdBy: "user-1",
      }),
    ).rejects.toThrow("Data de término deve ser posterior ao início.");
  });

  it("normaliza tag de equipamento", async () => {
    const gateway = gatewayFake();

    await criarEquipamentoPmoc(gateway, {
      propertyId: "prop-1",
      auvoEquipmentId: 987,
      tag: " ac-02 ",
      type: "cassete",
      brand: "  LG ",
      model: null,
      capacityBtu: 24000,
      location: "  Salão ",
      environment: null,
      floor: null,
      refrigerant: "R-410A",
      phase: "mono",
      condition: "bom",
      notes: null,
      createdBy: "user-1",
    });

    expect(gateway.criarEquipamento).toHaveBeenCalledWith(
      expect.objectContaining({
        auvoEquipmentId: 987,
        tag: "AC-02",
        brand: "LG",
        location: "Salão",
      }),
    );
  });

  it("bloqueia importação de equipamento sem imóvel PMOC", async () => {
    const gateway = gatewayFake();

    await expect(
      criarEquipamentoPmoc(gateway, {
        propertyId: "",
        auvoEquipmentId: 101,
        tag: "AC-01",
        type: "split-hiwall",
        brand: null,
        model: null,
        capacityBtu: null,
        location: null,
        environment: null,
        floor: null,
        refrigerant: "R-410A",
        phase: null,
        condition: "bom",
        notes: null,
        createdBy: "user-1",
      }),
    ).rejects.toThrow("Imóvel PMOC é obrigatório.");
    expect(gateway.criarEquipamento).not.toHaveBeenCalled();
  });
});
