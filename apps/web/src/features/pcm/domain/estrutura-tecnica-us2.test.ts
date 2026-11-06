import { describe, expect, it } from "vitest";
import { montarArvoreAtivos } from "./arvore-ativos";
import type { EquipamentoItem } from "./equipamentos";
import type { Area, Local } from "./hierarquia";
import {
  validarMembroMesmoCliente,
  validarMembroNaoDuplicado,
  validarMembroSemOutroSistema,
  type Sistema,
} from "./sistemas";

const area: Area = {
  id: "area-a", clienteId: "cliente-a", nome: "Torre A", descricao: null, ordem: 0, ativo: true,
};
const locais: Local[] = [
  { id: "hall-norte", areaId: area.id, parentId: null, nome: "Hall Norte", tipoId: null, tipoNome: null, descricao: null, ordem: 0, ativo: true },
  { id: "hall-sul", areaId: area.id, parentId: null, nome: "Hall Sul", tipoId: null, tipoNome: null, descricao: null, ordem: 1, ativo: true },
];
const sistema: Sistema = {
  id: "sistema-extintores", clienteId: "cliente-a", areaId: area.id, localId: null,
  nome: "Sistema de Extintores", categoriaId: "cat-pci", categoria: "PCI", tipo: null,
  descricao: null, ativo: true, auvoId: null, auvoEquipmentId: null, codigo: "SIS-PCI-01",
  auvoSyncStatus: null, auvoSyncError: null, auvoSyncedAt: null,
};
const componente = (id: string, localId: string): EquipamentoItem => ({
  id, nome: `Extintor ${id}`, identificador: id, categoriaId: "cat-pci", categoria: "PCI",
  clientId: "cliente-a", clienteNome: "Cliente A", auvoCustomerId: null, localizacao: null,
  observacoes: null, ativo: true, auvoId: null, auvoSyncStatus: null, auvoSyncError: null,
  auvoSyncedAt: null, urlImagem: null, uriAnexos: [], localId, tipo: "componente",
  parentItemId: null, areaId: area.id,
});

describe("E01-S176 US2 — Sistema distribuído e contexto por Local", () => {
  it("mostra membros de dois Locais sob o mesmo Sistema e preserva a posição física", () => {
    const arvore = montarArvoreAtivos({
      cliente: { id: "cliente-a", nome: "Cliente A" },
      areas: [area],
      locais,
      sistemas: [sistema],
      componentes: [componente("extintor-norte", "hall-norte"), componente("extintor-sul", "hall-sul")],
      membros: [
        { sistemaId: sistema.id, itemId: "extintor-norte" },
        { sistemaId: sistema.id, itemId: "extintor-sul" },
      ],
    });
    const sistemaNaArvore = arvore.filhos[0]?.filhos.find((no) => no.id === sistema.id);
    expect(sistemaNaArvore?.filhos.map((no) => no.id)).toEqual(["extintor-norte", "extintor-sul"]);
    expect(sistemaNaArvore?.filhos.map((no) => no.posicaoDivergente)).toEqual([
      "Torre A > Hall Norte",
      "Torre A > Hall Sul",
    ]);
    expect(arvore.total).toBe(3);
  });

  it("impede composição duplicada, outro Sistema vigente e mistura de Clientes", () => {
    expect(() => validarMembroMesmoCliente("cliente-a", "cliente-a")).not.toThrow();
    expect(() => validarMembroMesmoCliente("cliente-a", "cliente-b")).toThrow(
      "Item deve pertencer ao mesmo cliente do Sistema.",
    );
    expect(() => validarMembroNaoDuplicado([], "extintor-norte")).not.toThrow();
    expect(() => validarMembroNaoDuplicado([{ itemId: "extintor-norte" }], "extintor-norte")).toThrow(
      "Este item já faz parte do Sistema.",
    );
    expect(() => validarMembroSemOutroSistema(sistema.id, null)).not.toThrow();
    expect(() => validarMembroSemOutroSistema(sistema.id, { sistemaId: "outro", sistemaNome: "Sistema A" })).toThrow(
      "Componente já pertence ao Sistema «Sistema A». Remova de lá antes.",
    );
  });
});
