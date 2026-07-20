import { describe, expect, it } from "vitest";
import { montarColunasBoard } from "./board-ativos";
import type { EquipamentoItem } from "./equipamentos";
import type { Area, Local } from "./hierarquia";

const area: Area = {
  id: "area-1",
  clienteId: "cli-1",
  nome: "Torre A",
  descricao: null,
  ordem: 0,
  ativo: true,
};

function local(over: Partial<Local> & Pick<Local, "id" | "nome">): Local {
  return {
    areaId: "area-1",
    parentId: null,
    tipoId: null,
    tipoNome: null,
    descricao: null,
    ordem: 0,
    ativo: true,
    ...over,
  };
}

function item(
  over: Partial<EquipamentoItem> & Pick<EquipamentoItem, "id" | "nome">,
): EquipamentoItem {
  return {
    identificador: null,
    categoria: null,
    clientId: "cli-1",
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
    localId: null,
    tipo: "equipamento",
    parentItemId: null,
    ...over,
  };
}

describe("board-ativos — montarColunasBoard", () => {
  const andar3 = local({ id: "l-andar3", nome: "3º andar", ordem: 0 });
  const sala302 = local({ id: "l-sala302", nome: "Sala 302", parentId: "l-andar3", ordem: 0 });
  const cobertura = local({ id: "l-cob", nome: "Cobertura", ordem: 1 });
  const locais = [andar3, sala302, cobertura];

  it("coluna por Local nível-1, ordenada por ordem (AC-2)", () => {
    const colunas = montarColunasBoard(area, locais, []);
    expect(colunas.map((c) => c.localNome)).toEqual(["3º andar", "Cobertura"]);
    expect(colunas.every((c) => c.totalItens === 0)).toBe(true); // nível-1 vazio ainda aparece
  });

  it("item no Local nível-1 vai pra itensDiretos, sem subgrupo (AC-2)", () => {
    const colunas = montarColunasBoard(area, locais, [
      item({ id: "i1", nome: "Bomba", localId: "l-andar3" }),
    ]);
    const c = colunas.find((x) => x.localId === "l-andar3");
    expect(c?.itensDiretos.map((i) => i.nome)).toEqual(["Bomba"]);
    expect(c?.subgrupos).toHaveLength(0);
    expect(c?.totalItens).toBe(1);
  });

  it("item em sub-local vira subgrupo dentro da coluna do nível-1 (AC-2)", () => {
    const colunas = montarColunasBoard(area, locais, [
      item({ id: "i1", nome: "Ar-condicionado", localId: "l-sala302" }),
    ]);
    const c = colunas.find((x) => x.localId === "l-andar3");
    expect(c?.itensDiretos).toHaveLength(0);
    expect(c?.subgrupos).toEqual([
      {
        localId: "l-sala302",
        localNome: "Sala 302",
        itens: [expect.objectContaining({ id: "i1", nome: "Ar-condicionado" })],
      },
    ]);
    expect(c?.totalItens).toBe(1);
  });

  it("item sem localId vai pra coluna 'Sem local' (AC-3)", () => {
    const colunas = montarColunasBoard(area, locais, [
      item({ id: "i1", nome: "Extintor solto", localId: null }),
    ]);
    const sem = colunas.find((x) => x.localId === null);
    expect(sem?.localNome).toBe("Sem local");
    expect(sem?.itensDiretos.map((i) => i.nome)).toEqual(["Extintor solto"]);
  });

  it("'Sem local' só aparece quando há item sem local", () => {
    expect(montarColunasBoard(area, locais, []).some((c) => c.localId === null)).toBe(false);
  });

  it("item cujo localId é de outra Área não entra no board da Área atual (borda)", () => {
    const outra = local({ id: "l-outra", nome: "Sala X", areaId: "area-2" });
    const colunas = montarColunasBoard(
      area,
      [...locais, outra],
      [item({ id: "i1", nome: "Fantasma", localId: "l-outra" })],
    );
    const total = colunas.reduce((s, c) => s + c.totalItens, 0);
    expect(total).toBe(0);
  });
});
