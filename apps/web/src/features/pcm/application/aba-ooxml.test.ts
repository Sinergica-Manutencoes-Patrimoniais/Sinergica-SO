// @vitest-environment jsdom
import { expect, it } from "vitest";
import { interpretarAbaOoxml } from "./aba-ooxml";

const aba = (conteudo: string) => `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${conteudo}</sheetData></worksheet>`;
it("preserva texto, zero, célula vazia e fórmula sem calcular", () => {
  const xml = aba('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>0</v></c><c r="C1"/><c r="D1"><f>SUM(B1,1)</f><v>1</v></c></row>');
  expect(interpretarAbaOoxml(xml, ["Extintores"])).toEqual([
    { referencia: "A1", linha: 1, coluna: 1, tipo: "texto", valor: "Extintores", estilo: null, formula: null },
    { referencia: "B1", linha: 1, coluna: 2, tipo: "numero", valor: "0", estilo: null, formula: null },
    { referencia: "C1", linha: 1, coluna: 3, tipo: "vazio", valor: null, estilo: null, formula: null },
    { referencia: "D1", linha: 1, coluna: 4, tipo: "numero", valor: "1", estilo: null, formula: "SUM(B1,1)" },
  ]);
});
it("preserva números com estilo de data como números e não inventa cache", () => {
  expect(interpretarAbaOoxml(aba('<row r="2"><c r="A2" s="4"><v>45292</v></c><c r="B2"><f>A2+1</f></c></row>'), [])).toEqual([
    { referencia: "A2", linha: 2, coluna: 1, tipo: "numero", valor: "45292", estilo: 4, formula: null },
    { referencia: "B2", linha: 2, coluna: 2, tipo: "vazio", valor: null, estilo: null, formula: "A2+1" },
  ]);
});
it("recusa DTD, referências repetidas e strings não encontradas", () => {
  expect(() => interpretarAbaOoxml('<!DOCTYPE x><worksheet/>', [])).toThrow();
  expect(() => interpretarAbaOoxml(aba('<row r="1"><c r="A1"/><c r="A1"/></row>'), [])).toThrow();
  expect(() => interpretarAbaOoxml(aba('<row r="1"><c r="A1" t="s"><v>4</v></c></row>'), [])).toThrow();
});
it("recusa XML inválido e coordenadas fora dos limites", () => {
  expect(() => interpretarAbaOoxml('<worksheet>', [])).toThrow();
  expect(() => interpretarAbaOoxml(aba('<row r="10001"><c r="A10001"/></row>'), [])).toThrow();
  expect(() => interpretarAbaOoxml(aba('<row r="1"><c r="SG1"/></row>'), [])).toThrow();
});
it("preserva texto inline, booleano e data declarada sem conversão", () => {
  const resultado = interpretarAbaOoxml(aba('<row r="1"><c r="A1" t="inlineStr"><is><r><t>abc</t></r><r><t> def</t></r></is></c><c r="B1" t="b"><v>0</v></c><c r="C1" t="d"><v>2026-10-30</v></c></row>'), []);
  expect(resultado.map((c) => [c.tipo, c.valor])).toEqual([["texto", "abc def"], ["booleano", "0"], ["data", "2026-10-30"]]);
});
it("recusa texto inline ambíguo e fórmula compartilhada sem identificador", () => {
  expect(() => interpretarAbaOoxml(aba('<row r="1"><c r="A1" t="inlineStr"><is><t>x</t><r><t>y</t></r></is></c></row>'), [])).toThrow();
  expect(() => interpretarAbaOoxml(aba('<row r="1"><c r="A1"><f t="shared">A1</f></c></row>'), [])).toThrow();
});
it("preserva metadados de fórmula compartilhada sem calcular ou expandir", () => {
  const dados = interpretarAbaOoxml(aba('<row r="1"><c r="A1"><f t="shared" si="0" ref="A1:A2">B1+1</f><v>2</v></c></row><row r="2"><c r="A2"><f t="shared" si="0"/><v>3</v></c></row>'), []);
  expect(dados[0]).toMatchObject({ formula: "B1+1", formulaCompartilhada: { indice: 0, referencia: "A1:A2" }, valor: "2" });
  expect(dados[1]).toMatchObject({ formula: null, formulaCompartilhada: { indice: 0, referencia: null }, valor: "3" });
});
