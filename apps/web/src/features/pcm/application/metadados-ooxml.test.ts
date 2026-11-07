// @vitest-environment jsdom
import { expect, it } from "vitest";
import { interpretarLivroOoxml, interpretarStringsOoxml } from "./metadados-ooxml";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { interpretarAbaOoxml } from "./aba-ooxml";

const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageNs = "http://schemas.openxmlformats.org/package/2006/relationships";
const livro = (sheets: string, prop = "") => `<workbook xmlns="${ns}" xmlns:r="${relNs}">${prop}<sheets>${sheets}</sheets></workbook>`;
const relacionamentos = (items: string) => `<Relationships xmlns="${packageNs}">${items}</Relationships>`;
const rel = (id: string, path: string, mode = "") => `<Relationship Id="${id}" Type="${relNs}/worksheet" Target="${path}" ${mode}/>`;

it("preserva ordem, visibilidade e sistema de datas das abas", () => {
  const w = livro('<sheet name="Rimini" sheetId="1" r:id="rId1"/><sheet name="Base" sheetId="2" state="hidden" r:id="rId2"/>', '<workbookPr date1904="1"/>');
  expect(interpretarLivroOoxml(w, relacionamentos(rel("rId2", "/xl/worksheets/sheet2.xml") + rel("rId1", "worksheets/sheet1.xml")))).toEqual({ data1904: true, abas: [
    { id: 1, nome: "Rimini", estado: "visible", caminho: "xl/worksheets/sheet1.xml" },
    { id: 2, nome: "Base", estado: "hidden", caminho: "xl/worksheets/sheet2.xml" },
  ] });
});
it("recusa destinos externos, travessia, duplicidade e relação ausente", () => {
  const w = livro('<sheet name="A" sheetId="1" r:id="rId1"/>');
  for (const alvo of ["../secret.xml", "worksheets/%2e%2e/secret.xml", "https://example.com/a.xml"]) expect(() => interpretarLivroOoxml(w, relacionamentos(rel("rId1", alvo)))).toThrow();
  expect(() => interpretarLivroOoxml(w, relacionamentos(rel("rId1", "worksheets/sheet1.xml", 'TargetMode="External"')))).toThrow();
  expect(() => interpretarLivroOoxml(w, relacionamentos(rel("rId1", "worksheets/sheet1.xml") + rel("rId1", "worksheets/sheet2.xml")))).toThrow();
  expect(() => interpretarLivroOoxml(w, relacionamentos(""))).toThrow();
});
it("lê strings compartilhadas simples e ricas preservando espaços", () => {
  const s = `<sst xmlns="${ns}"><si><t xml:space="preserve"> Texto </t></si><si><r><t>São</t></r><r><t> Paulo</t></r></si><si><t></t></si></sst>`;
  expect(interpretarStringsOoxml(s)).toEqual([" Texto ", "São Paulo", ""]);
});
it("recusa XML hostil, texto ambíguo e duplicidade de aba", () => {
  expect(() => interpretarStringsOoxml('<!DOCTYPE a [<!ENTITY x "texto">]><sst/>')).toThrow();
  expect(() => interpretarStringsOoxml(`<sst xmlns="${ns}"><si><t>a</t><r><t>b</t></r></si></sst>`)).toThrow();
  expect(() => interpretarLivroOoxml(livro('<sheet name="A" sheetId="1" r:id="rId1"/><sheet name="a" sheetId="2" r:id="rId2"/>'), relacionamentos(rel("rId1", "worksheets/sheet1.xml") + rel("rId2", "worksheets/sheet2.xml")))).toThrow();
});

it.each([
  ["plano-rimini-2026-final.xlsx", 7, true],
  ["plano-i-home-2026.xlsx", 3, true],
])("interpreta metadados das fontes conhecidas %s", (nome, quantidade, abaSuportada) => {
  // Apenas fixtures conhecidas do repositório; unzipSync não é apropriado para entrada não confiável.
  const zip = unzipSync(readFileSync(`../../docs/planejamento/plano-manutencao/fontes/${nome}`));
  const livro = interpretarLivroOoxml(strFromU8(zip["xl/workbook.xml"]!), strFromU8(zip["xl/_rels/workbook.xml.rels"]!));
  expect(livro.abas).toHaveLength(quantidade);
  expect(livro.abas.find((aba) => aba.nome === "CRONOGRAMA")?.caminho).toBe("xl/worksheets/sheet2.xml");
  const strings = interpretarStringsOoxml(strFromU8(zip["xl/sharedStrings.xml"]!));
  const lerAba = () => interpretarAbaOoxml(strFromU8(zip["xl/worksheets/sheet2.xml"]!), strings);
  if (abaSuportada) expect(lerAba().length).toBeGreaterThan(0);
  else expect(lerAba).toThrow("Fórmula compartilhada ou vazia não suportada");
});
