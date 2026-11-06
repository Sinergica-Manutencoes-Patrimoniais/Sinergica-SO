import { expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readFileSync } from "node:fs";
import { extrairXlsxLimitado } from "./extrair-xlsx-limitado";

it("extrai partes sem escrever arquivos", async () => {
  const zip = zipSync({ "xl/workbook.xml": strToU8("<workbook/>"), "xl/worksheets/sheet1.xml": strToU8("<sheet/>") });
  const partes = await extrairXlsxLimitado(zip);
  expect(new TextDecoder().decode(partes.get("xl/workbook.xml"))).toBe("<workbook/>");
  expect(partes.size).toBe(2);
});
it("fixa os bytes de entrada antes da leitura assíncrona", async () => {
  const zip = zipSync({ "xl/workbook.xml": strToU8("original") });
  const leitura = extrairXlsxLimitado(zip);
  zip.fill(0);
  const partes = await leitura;
  expect(new TextDecoder().decode(partes.get("xl/workbook.xml"))).toBe("original");
});
it("recusa caminho suspeito e nomes que diferem apenas por caixa", async () => {
  await expect(extrairXlsxLimitado(zipSync({ "../fora.xml": strToU8("x") }))).rejects.toThrow();
  await expect(extrairXlsxLimitado(zipSync({ "xl/A.xml": strToU8("x"), "xl/a.xml": strToU8("y") }))).rejects.toThrow();
});
it("recusa saída descompactada acima do limite mesmo com arquivo pequeno", async () => {
  const zip = zipSync({ "xl/grande.xml": new Uint8Array(4_194_305).fill(65) });
  expect(zip.length).toBeLessThan(100_000);
  await expect(extrairXlsxLimitado(zip)).rejects.toThrow();
});
it("recusa pacote cujo tamanho declarado é menor que os bytes produzidos", async () => {
  const zip = zipSync({ "xl/grande.xml": new Uint8Array(4_194_305).fill(65) });
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  view.setUint32(22, 1, true);
  let central = -1;
  for (let i = 0; i <= zip.length - 4; i++) if (view.getUint32(i, true) === 0x02014b50) { central = i; break; }
  expect(central).toBeGreaterThan(0);
  view.setUint32(central + 24, 1, true);
  await expect(extrairXlsxLimitado(zip)).rejects.toThrow();
});
it.each(["plano-rimini-2026-final.xlsx", "plano-i-home-2026.xlsx"])("extrai partes das fontes conhecidas %s", async (nome) => {
  const bytes = readFileSync(`../../docs/planejamento/plano-manutencao/fontes/${nome}`);
  const partes = await extrairXlsxLimitado(bytes);
  expect(partes.has("xl/workbook.xml")).toBe(true);
  expect(partes.has("xl/worksheets/sheet2.xml")).toBe(true);
});
it("recusa CRC corrompido e entrada cancelada", async () => {
  const zip = zipSync({ "xl/a.xml": [strToU8("conteúdo"), { level: 0 }] });
  const nome = new DataView(zip.buffer, zip.byteOffset, zip.byteLength).getUint16(26, true);
  zip[30 + nome] = zip[30 + nome]! ^ 1;
  await expect(extrairXlsxLimitado(zip)).rejects.toThrow();
  const abort = new AbortController(); abort.abort();
  await expect(extrairXlsxLimitado(zip, abort.signal)).rejects.toThrow();
});
