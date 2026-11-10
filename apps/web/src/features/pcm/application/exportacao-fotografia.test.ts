import { expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import type { SnapshotExportacao } from "./snapshot-exportacao";
import { prepararExportacaoFotografia, projetarFotografiaExportacao } from "./exportacao-fotografia";
import { linhasVersaoPlano, textoVersaoPlano } from "../domain/exportacao-plano";
import { xlsxVersaoPlano } from "../infrastructure/exportacao-plano-xlsx";
import { gerarPdfVersaoPlano } from "../infrastructure/pdf-versao-plano";

const identidade = { clienteId: "00000000-0000-4000-8000-000000000001", planoId: "00000000-0000-4000-8000-000000000002", versaoId: "00000000-0000-4000-8000-000000000003" };
const bomba = "00000000-0000-4000-8000-000000000004";
const quadro = "00000000-0000-4000-8000-000000000005";
const fotografia: SnapshotExportacao = { ...identidade, planoNome: "Plano aprovado", versaoNumero: 3, vigenciaInicio: "2026-01-01", vigenciaFim: null, snapshotHash: "a".repeat(32), total: 2, capacidadeIncluida: false, cronogramaOperacionalIncluido: false,
  rotinas: [
    { id: "10000000-0000-4000-8000-000000000001", planoId: identidade.planoId, versaoId: identidade.versaoId, nome: "Mensal", alvoTipo: "sistema", alvoId: bomba, alvoNome: "Bomba", modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-01-01", tempoMinutos: null, tipoTempo: null, toleranciaAntes: 0, toleranciaDepois: 2 },
    { id: "10000000-0000-4000-8000-000000000002", planoId: identidade.planoId, versaoId: identidade.versaoId, nome: "Semanal", alvoTipo: "componente", alvoId: quadro, alvoNome: "Quadro", modo: "visita", intervalo: 1, unidade: "semanas", dataBase: null, tempoMinutos: 60, tipoTempo: "total", toleranciaAntes: 1, toleranciaDepois: 0 },
  ] };

it("PDF e planilha usam mesmo filtro e identificam alvo, versão e tempo pendente", () => {
  const dados = projetarFotografiaExportacao(fotografia, { alvoTipo: "sistema", alvoId: bomba, modo: "calendario" });
  const linhas = linhasVersaoPlano(dados);
  const pdf = textoVersaoPlano(dados);
  expect(dados.rotinas).toHaveLength(1);
  expect(linhas).toHaveLength(2);
  expect(JSON.stringify(linhas)).toContain("Mensal");
  expect(JSON.stringify(linhas)).not.toContain("Semanal");
  for (const texto of ["Plano aprovado", bomba, "a validar", "calendario", "a".repeat(32)]) {
    expect(JSON.stringify(linhas)).toContain(texto);
    expect(pdf).toContain(texto);
  }
  expect(pdf).toContain("não incluída");
  expect(pdf).toContain("não representa execução");
});

it("filtro sem correspondência registra filtro e resultado vazio", () => {
  const dados = projetarFotografiaExportacao(fotografia, { alvoTipo: "grupo" });
  expect(dados.rotinas).toHaveLength(0);
  expect(dados.filtro).toContain("grupo");
  expect(textoVersaoPlano(dados)).toContain("sem Rotinas");
});

it("gera PDF válido com os dados da fotografia e do filtro", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  const desenhar = vi.spyOn(PDFPage.prototype, "drawText");
  try {
    const dados = projetarFotografiaExportacao(fotografia, { alvoTipo: "sistema" });
    const arquivo = await gerarPdfVersaoPlano(dados);
    expect(arquivo.type).toBe("application/pdf");
    expect((await PDFDocument.load(await arquivo.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
    const texto = desenhar.mock.calls.map(([value]) => value).join("\n");
    expect(texto).toContain("Plano aprovado");
    expect(texto).toContain("Mensal");
    expect(texto).not.toContain("Semanal");
    expect(texto).toContain("a validar");
    expect(texto).toContain("tipo=sistema");
  } finally { desenhar.mockRestore(); vi.unstubAllGlobals(); }
});

it("só entrega XLSX depois de reconferir a fotografia completa", async () => {
  const obter = vi.fn(async () => ({ ...fotografia, posicao: 0, proximaPosicao: null }));
  const arquivo = await prepararExportacaoFotografia(obter, identidade, { alvoTipo: "sistema" }, xlsxVersaoPlano);
  expect(arquivo.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect(obter).toHaveBeenCalledTimes(2);
});

it("não entrega arquivo se fotografia mudar durante geração", async () => {
  let chamadas = 0;
  const obter = async () => ({ ...fotografia, planoNome: ++chamadas === 1 ? "Plano aprovado" : "Alterado", posicao: 0, proximaPosicao: null });
  await expect(prepararExportacaoFotografia(obter, identidade, {}, xlsxVersaoPlano)).rejects.toThrow("Fotografia alterada");
});

it("prepara PDF com o mesmo fluxo de conferência da fotografia", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  try {
    const obter = vi.fn(async () => ({ ...fotografia, posicao: 0, proximaPosicao: null }));
    const arquivo = await prepararExportacaoFotografia(obter, identidade, {}, gerarPdfVersaoPlano);
    expect(arquivo.type).toBe("application/pdf");
    expect(obter).toHaveBeenCalledTimes(2);
  } finally { vi.unstubAllGlobals(); }
});

it("preserva o filtro solicitado durante a leitura assíncrona", async () => {
  const filtro: { alvoTipo: "sistema" | "componente" } = { alvoTipo: "sistema" };
  const obter = async () => { filtro.alvoTipo = "componente"; return { ...fotografia, posicao: 0, proximaPosicao: null }; };
  const arquivo = await prepararExportacaoFotografia(obter, identidade, filtro, async (dados) => new Blob([textoVersaoPlano(dados)]));
  expect(await arquivo.text()).toContain("Mensal");
  expect(await arquivo.text()).not.toContain("Semanal");
});

it("rejeita fotografia de outro Cliente mesmo se a identidade de entrada mudar", async () => {
  const entrada = { ...identidade };
  const outroCliente = "00000000-0000-4000-8000-000000000099";
  const obter = async () => { entrada.clienteId = outroCliente; return { ...fotografia, clienteId: outroCliente, posicao: 0, proximaPosicao: null }; };
  await expect(prepararExportacaoFotografia(obter, entrada, {}, async () => new Blob(["inválido"]))).rejects.toThrow("Identidade de fotografia divergente");
});
