// @vitest-environment jsdom
import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extrairXlsxLimitado } from "../infrastructure/extrair-xlsx-limitado";
import { lerPartesOoxml } from "./ler-partes-ooxml";
import { matrizCronogramaOoxml } from "./matriz-cronograma-ooxml";
import { lerCronogramaPlano } from "../domain/leitura-plano";
import { previaCronogramaOoxml } from "./previa-cronograma-ooxml";

const codificar = (valor: string) => new TextEncoder().encode(valor);
const partes = () => new Map([
  ["xl/workbook.xml", codificar('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cronograma" sheetId="1" r:id="rId1"/></sheets></workbook>')],
  ["xl/_rels/workbook.xml.rels", codificar('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')],
  ["xl/sharedStrings.xml", codificar('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Extintores</t></si></sst>')],
  ["xl/worksheets/sheet1.xml", codificar('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>')],
]);

it("associa a aba escolhida às suas células e strings compartilhadas", () => {
  const resultado = lerPartesOoxml(partes(), "Cronograma");
  expect(resultado.aba.nome).toBe("Cronograma");
  expect(resultado.celulas[0]).toMatchObject({ referencia: "A1", tipo: "texto", valor: "Extintores" });
});

it("recusa aba ausente, parte referenciada ausente e UTF-8 inválido", () => {
  expect(() => lerPartesOoxml(partes(), "Outra")).toThrow();
  const semAba = partes(); semAba.delete("xl/worksheets/sheet1.xml");
  expect(() => lerPartesOoxml(semAba, "Cronograma")).toThrow();
  const invalido = partes(); invalido.set("xl/workbook.xml", new Uint8Array([0xff]));
  expect(() => lerPartesOoxml(invalido, "Cronograma")).toThrow();
});

it.each([["plano-rimini-2026-final.xlsx", 59], ["plano-i-home-2026.xlsx", 53]] as const)("lê a aba CRONOGRAMA da fonte %s após extração limitada", async (nome, esperadas) => {
  const arquivo = readFileSync(`../../docs/planejamento/plano-manutencao/fontes/${nome}`);
  const resultado = lerPartesOoxml(await extrairXlsxLimitado(arquivo), "CRONOGRAMA");
  expect(resultado.aba.caminho).toBe("xl/worksheets/sheet2.xml");
  expect(resultado.celulas.length).toBeGreaterThan(0);
  const previa = matrizCronogramaOoxml(resultado.celulas, resultado.livro.data1904);
  if (previa.pendencias.length === 0) expect(lerCronogramaPlano({ CRONOGRAMA: previa.matriz }).linhas.length).toBeGreaterThan(0);
  else expect(previa.pendencias.every((p) => p.motivo === "formula" || p.motivo === "erro")).toBe(true);
  const conferencia = previaCronogramaOoxml(resultado.celulas, resultado.livro.data1904, "fonte", "cliente", [], {});
  expect(conferencia.estado).toBe("conferivel");
  if (conferencia.estado !== "conferivel") throw new Error("fonte bloqueada por fórmula relevante");
  expect(conferencia.linhas).toHaveLength(esperadas);
  expect(conferencia.avisos.length).toBeGreaterThan(0);
});
