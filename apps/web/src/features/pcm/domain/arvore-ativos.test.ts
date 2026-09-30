import { describe, expect, it } from "vitest";
import { filtrarArvore, montarArvoreAtivos } from "./arvore-ativos";
import type { EquipamentoItem } from "./equipamentos";
import type { Area, Local } from "./hierarquia";
import type { Sistema } from "./sistemas";

const area = (id: string, nome: string): Area => ({
  id,
  nome,
  clienteId: "c",
  descricao: null,
  ordem: 0,
  ativo: true,
});
const local = (id: string, nome: string, parentId: string | null = null): Local => ({
  id,
  nome,
  areaId: "a",
  parentId,
  sigla: null,
  tipoId: null,
  tipoNome: null,
  descricao: null,
  ordem: 0,
  ativo: true,
});
const sistema = (id: string, localId: string | null): Sistema => ({
  id,
  clienteId: "c",
  areaId: localId ? null : "a",
  localId,
  nome: "Sistema Incêndio",
  categoriaId: "cat",
  categoria: "PCI",
  tipo: null,
  descricao: null,
  ativo: true,
  auvoId: null,
  auvoEquipmentId: null,
  codigo: "CLI-PCI-SIS-01",
  auvoSyncStatus: null,
  auvoSyncError: null,
  auvoSyncedAt: null,
});
const componente = (id: string, nome: string, localId: string | null): EquipamentoItem => ({
  id,
  nome,
  identificador: "CLI-PCI-COM-01",
  categoriaId: "cat",
  categoria: "PCI",
  clientId: "c",
  clienteNome: "Cliente",
  auvoCustomerId: null,
  localizacao: null,
  observacoes: null,
  ativo: true,
  auvoId: null,
  auvoSyncStatus: null,
  auvoSyncError: null,
  auvoSyncedAt: null,
  urlImagem: null,
  uriAnexos: [],
  localId,
  tipo: "componente",
  parentItemId: null,
  areaId: localId ? null : "a",
});

describe("montarArvoreAtivos", () => {
  it("pendura membro no Sistema e conta cada ativo uma vez", () => {
    const arvore = montarArvoreAtivos({
      cliente: { id: "c", nome: "Cliente" },
      areas: [area("a", "Torre A")],
      locais: [local("l", "Térreo")],
      sistemas: [sistema("s", "l")],
      componentes: [componente("i", "Hidrante", "l")],
      membros: [{ sistemaId: "s", itemId: "i" }],
    });
    const torre = arvore.filhos.find((no) => no.nome === "Torre A");
    const terreo = torre?.filhos.find((no) => no.nome === "Térreo");
    const sis = terreo?.filhos.find((no) => no.nome === "Sistema Incêndio");
    expect(sis?.nome).toBe("Sistema Incêndio");
    expect(sis?.filhos.map((n) => n.nome)).toEqual(["Hidrante"]);
    expect(arvore.total).toBe(2);
  });

  it("filtro mantém ancestrais e busca identificador sem acento/caixa", () => {
    const no = montarArvoreAtivos({
      cliente: { id: "c", nome: "Cliente" },
      areas: [area("a", "Torre A")],
      locais: [],
      sistemas: [],
      componentes: [componente("i", "Câmera", null)],
      membros: [],
    });
    expect(filtrarArvore(no, "cli-pci")).not.toBeNull();
    expect(filtrarArvore(no, "inexistente")).toBeNull();
  });
});
