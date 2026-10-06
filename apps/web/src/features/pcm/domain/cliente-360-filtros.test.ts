import { describe, expect, it } from "vitest";
import {
  filtrarComponentes360,
  filtrarSistemas360,
  normalizarBusca360,
} from "./cliente-360-filtros";

const itens = [
  {
    id: "item-1",
    nome: "Extintor Hall",
    identificador: "GUA-PCI-EXT-01",
    categoriaId: "pci",
    areaId: "torre-a",
    localId: "hall-1",
    ativo: true,
    auvoSyncStatus: "synced",
  },
  {
    id: "item-2",
    nome: "Bomba d'água",
    identificador: "GUA-HID-BOM-01",
    categoriaId: "hidraulica",
    areaId: "torre-b",
    localId: null,
    ativo: false,
    auvoSyncStatus: "error",
  },
];

describe("filtros do Cliente 360", () => {
  it("normaliza caixa, acento e separadores para busca", () => {
    expect(normalizarBusca360(" BÔMBA-d’Água ")).toBe("bomba d agua");
  });

  it("combina critérios diferentes com AND e escolhas do mesmo critério com OR", () => {
    expect(
      filtrarComponentes360(
        itens,
        { "item-1": "sis-pci", "item-2": "sis-hid" },
        {
          busca: "gua",
          categoriaIds: ["pci", "hidraulica"],
          areaIds: ["torre-a"],
          localIds: [],
          sistemaIds: [],
          situacao: "ativos",
          syncStatuses: [],
        },
      ),
    ).toEqual([itens[0]]);
  });

  it("reconhece o sentinela Sem sistema sem confundir com filtro vazio", () => {
    expect(
      filtrarComponentes360(
        itens,
        { "item-1": "sis-pci" },
        {
          busca: "",
          categoriaIds: [],
          areaIds: [],
          localIds: [],
          sistemaIds: ["sem_sistema"],
          situacao: "todos",
          syncStatuses: [],
        },
      ),
    ).toEqual([itens[1]]);
  });

  it("filtra sistemas pela composição calculada com os membros já carregados", () => {
    const sistemas = [
      {
        id: "sis-pci",
        nome: "PCI",
        codigo: "PCI-01",
        categoriaId: "pci",
        areaId: "torre-a",
        localId: null,
        ativo: true,
        auvoSyncStatus: "synced",
      },
      {
        id: "sis-vazio",
        nome: "Automação",
        codigo: null,
        categoriaId: "automacao",
        areaId: "torre-b",
        localId: null,
        ativo: true,
        auvoSyncStatus: "pending",
      },
    ];
    expect(
      filtrarSistemas360(sistemas, new Map([["sis-pci", 2]]), {
        busca: "",
        categoriaIds: [],
        areaIds: [],
        localIds: [],
        composicao: "vazios",
        situacao: "todos",
        syncStatuses: [],
      }),
    ).toEqual([sistemas[1]]);
  });
});
