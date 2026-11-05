import { expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { contextoExportacaoValido, csvVersaoPlano, linhasVersaoPlano } from "./exportacao-plano";
import { xlsxVersaoPlano } from "../infrastructure/exportacao-plano-xlsx";

it("aceita somente Rotinas distintas da mesma versão e Plano do Cliente", () => {
  const plano = { id: "p", clienteId: "c" };
  const versao = { id: "v", planoId: "p", estado: "aprovado" };
  const rotinas = [{ id: "r", planoId: "p", versaoId: "v" }];
  expect(contextoExportacaoValido("c", plano, versao, rotinas)).toBe(true);
  expect(contextoExportacaoValido("outro", plano, versao, rotinas)).toBe(false);
  expect(contextoExportacaoValido("c", plano, { ...versao, planoId: "outro" }, rotinas)).toBe(false);
  expect(contextoExportacaoValido("c", plano, { ...versao, estado: "rascunho" }, rotinas)).toBe(false);
  expect(contextoExportacaoValido("c", plano, versao, [{ id: "r", planoId: "p", versaoId: "outra" }])).toBe(false);
  expect(contextoExportacaoValido("c", plano, versao, [...rotinas, ...rotinas])).toBe(false);
});

it("CSV identifica versão, filtro e capacidade ausente e preserva tempo pendente sem fórmula", () => {
  const csv = csvVersaoPlano({ clienteId: "c", planoNome: "Plano", versaoId: "v", versaoNumero: 2, vigenciaInicio: "2026-01-01", vigenciaFim: null,
    rotinas: [{ nome: "=perigo", alvoTipo: "sistema", alvoNome: "Bomba", modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-01-01", tempoMinutos: null, tipoTempo: null, toleranciaAntes: 0, toleranciaDepois: 0 }] });
  expect(csv).toContain('"Versão ID"');
  expect(csv).toContain('"v"');
  expect(csv).toContain('"todas as Rotinas da versão"');
  expect(csv).toContain('"não incluída"');
  expect(csv).toContain('"a validar"');
  expect(csv).toContain('"\'=perigo"');
});

it("CSV sem Rotinas mantém todas as colunas e informa explicitamente o estado vazio", () => {
  const csv = csvVersaoPlano({ clienteId: "c", planoNome: "Plano", versaoId: "v", versaoNumero: 1, vigenciaInicio: null, vigenciaFim: null, rotinas: [] });
  const [cabecalho, linha] = csv.trim().split("\r\n");
  expect(linha).toContain('"sem Rotinas"');
  expect(linha?.split(";")).toHaveLength(cabecalho!.split(";").length);
});

it("fornece dados tipados para exportação de planilha sem transformar texto em fórmula", () => {
  const linhas = linhasVersaoPlano({ clienteId: "c", planoNome: "Plano", versaoId: "v", versaoNumero: 2, vigenciaInicio: "2026-01-01", vigenciaFim: null,
    rotinas: [{ nome: "=1+1", alvoTipo: "sistema", alvoNome: "Bomba", modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-01-01", tempoMinutos: null, tipoTempo: null, toleranciaAntes: 0, toleranciaDepois: 0 }] });
  expect(linhas[0]?.[3]).toBe("Versão ID");
  expect(linhas[1]?.[3]).toBe("v");
  expect(linhas[1]?.[9]).toBe("=1+1");
  expect(linhas[1]?.[17]).toBe("a validar");
  expect(linhas[1]).toHaveLength(linhas[0]!.length);
});

it("gera XLSX em formato ZIP com tipo de conteúdo de planilha", async () => {
  const arquivo = await xlsxVersaoPlano({ clienteId: "c", planoNome: "Plano", versaoId: "v", versaoNumero: 1, vigenciaInicio: null, vigenciaFim: null, rotinas: [] });
  expect(arquivo.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect([...new Uint8Array(await arquivo.arrayBuffer()).slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
});

it("XLSX preserva texto com aparência de fórmula como célula textual", async () => {
  const arquivo = await xlsxVersaoPlano({ clienteId: "cliente", planoNome: "Plano", versaoId: "versao", versaoNumero: 1, vigenciaInicio: null, vigenciaFim: null,
    rotinas: [{ nome: "=1+1", alvoTipo: "sistema", alvoNome: "Bomba", modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-01-01", tempoMinutos: null, tipoTempo: null, toleranciaAntes: 0, toleranciaDepois: 0 }] });
  const zip = unzipSync(new Uint8Array(await arquivo.arrayBuffer()));
  const planilha = strFromU8(zip["xl/worksheets/sheet1.xml"]!);
  const textos = strFromU8(zip["xl/sharedStrings.xml"]!);
  expect(planilha).not.toMatch(/<f(?:\s|>)/);
  expect(textos).toContain("=1+1");
  expect(textos).toContain("a validar");
  expect(textos).toContain("versao");
});

it("rejeita a mesma Rotina com UUID em caixas diferentes", () => {
  const plano = { id: "p", clienteId: "c" };
  const versao = { id: "v", planoId: "p", estado: "aprovado" };
  const rotinas = ["ABCDEFAB-1234-1234-1234-123456789ABC", "abcdefab-1234-1234-1234-123456789abc"].map((id) => ({ id, planoId: "p", versaoId: "v" }));
  expect(contextoExportacaoValido("c", plano, versao, rotinas)).toBe(false);
});
