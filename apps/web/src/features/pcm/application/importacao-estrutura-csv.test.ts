import { describe, expect, it } from "vitest";
import { analisarEstruturaCsv, lerEstruturaCsv } from "./importacao-estrutura-csv";

const cabecalho = "chave;tipo;nome;observacoes;quantidade;codigoInformado;referenciaPai;sistemaProvisorio;localProvisorio;classificacao";

describe("importação de estrutura CSV", () => {
  it("rejeita arquivo vazio antes de processar linhas", () => {
    expect(() => analisarEstruturaCsv("")).toThrow(/Cabeçalho/);
  });

  it("preserva atributos nas colunas correspondentes", () => {
    const linhas = lerEstruturaCsv(`${cabecalho}\nch-1;componente;Bomba;\"A; B\";3;ABC-1;;;;`);
    expect(linhas).toEqual([{ chave: "ch-1", tipo: "componente", atributos: { nome: "Bomba", observacoes: "A; B", quantidade: "3", codigoInformado: "ABC-1" } }]);
  });
});
