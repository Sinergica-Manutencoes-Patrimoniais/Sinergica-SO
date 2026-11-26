import { describe, expect, it } from "vitest";
import { montarOpcoesTecnico } from "./filtro-tecnicos";

const comFabricio = [
  { tecnicoFuncionarioId: "tec-fabricio", tecnicoNome: "Fabrício" },
  { tecnicoFuncionarioId: "tec-ana", tecnicoNome: "Ana" },
];

describe("montarOpcoesTecnico", () => {
  it("lista os técnicos das OS carregadas, em ordem alfabética", () => {
    expect(montarOpcoesTecnico(comFabricio, "todos", new Map())).toEqual([
      { id: "tec-ana", nome: "Ana" },
      { id: "tec-fabricio", nome: "Fabrício" },
    ]);
  });

  it("mantém o técnico selecionado quando o novo recorte não tem OS dele (DEF-33)", () => {
    const conhecidos = new Map<string, string>();
    montarOpcoesTecnico(comFabricio, "todos", conhecidos);
    // Categoria muda para Preventiva: nenhuma OS do Fabrício no resultado.
    const opcoes = montarOpcoesTecnico([], "tec-fabricio", conhecidos);
    expect(opcoes).toEqual([{ id: "tec-fabricio", nome: "Fabrício" }]);
  });

  it("não inventa opção quando o filtro está em todos", () => {
    expect(montarOpcoesTecnico([], "todos", new Map())).toEqual([]);
  });

  it("usa rótulo genérico para selecionado nunca visto", () => {
    expect(montarOpcoesTecnico([], "tec-desconhecido", new Map())).toEqual([
      { id: "tec-desconhecido", nome: "Técnico" },
    ]);
  });

  it("não duplica o selecionado quando ele está no recorte", () => {
    const opcoes = montarOpcoesTecnico(comFabricio, "tec-fabricio", new Map());
    expect(opcoes.filter((o) => o.id === "tec-fabricio")).toHaveLength(1);
  });
});
