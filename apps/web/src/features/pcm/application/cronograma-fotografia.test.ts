import { expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { strFromU8, unzipSync } from "fflate";
import type { SnapshotExportacao } from "./snapshot-exportacao";
import { comporCronogramaFotografia, linhasCronogramaFotografia, textoCronogramaFotografia } from "./cronograma-fotografia";
import { gerarPdfCronogramaFotografia, gerarXlsxCronogramaFotografia } from "../infrastructure/exportar-cronograma-fotografia";
import { lerFonteCronogramaFotografia } from "./fonte-cronograma-fotografia";
import { prepararExportacaoCronograma } from "./preparar-exportacao-cronograma";

const ids = { clienteId: "00000000-0000-4000-8000-000000000001", planoId: "00000000-0000-4000-8000-000000000002", versaoId: "00000000-0000-4000-8000-000000000003" };
const rotinaId = "10000000-0000-4000-8000-000000000001";
const alvoId = "20000000-0000-4000-8000-000000000001";
const base: SnapshotExportacao = { ...ids, planoNome: "Plano", versaoNumero: 1, vigenciaInicio: "2026-01-01", vigenciaFim: null, snapshotHash: "a".repeat(32), total: 2, capacidadeIncluida: false, cronogramaOperacionalIncluido: false,
  rotinas: [
    { id: rotinaId, planoId: ids.planoId, versaoId: ids.versaoId, nome: "Trimestral", alvoTipo: "sistema", alvoId, alvoNome: "Bomba", modo: "calendario", intervalo: 3, unidade: "meses", dataBase: "2026-12-25", tempoMinutos: null, tipoTempo: null, toleranciaAntes: 0, toleranciaDepois: 0 },
    { id: "10000000-0000-4000-8000-000000000002", planoId: ids.planoId, versaoId: ids.versaoId, nome: "Semanal", alvoTipo: "sistema", alvoId, alvoNome: "Bomba", modo: "visita", intervalo: 1, unidade: "semanas", dataBase: null, tempoMinutos: 60, tipoTempo: "total", toleranciaAntes: 0, toleranciaDepois: 0 },
  ] };
const ocorrencia = { ...ids, id: "30000000-0000-4000-8000-000000000001", rotinaId, alvoId, vencimentoOriginal: "2026-12-25", dataProgramada: "2027-01-03" };

it("distingue calendário ancorado de programação informada e mantém feriado", () => {
  const resultado = comporCronogramaFotografia(base, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: ["2026-12-25"] }, [ocorrencia]);
  expect(resultado.baseline.map((linha) => [linha.vencimento, linha.feriadoInformado])).toEqual([["2026-12-25", true], ["2027-03-25", false]]);
  expect(resultado.programacoes).toEqual([expect.objectContaining({ vencimentoOriginal: "2026-12-25", dataProgramada: "2027-01-03" })]);
  expect(resultado.rotinasVisitaSemProjecao).toEqual([base.rotinas[1]!.id]);
  expect(resultado.completude).toBe("desconhecida");
  expect(resultado.execucaoIncluida).toBe(false);
});

it("não mistura Cliente, alvo ou ocorrências duplicadas", () => {
  const janela = { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: [] };
  expect(() => comporCronogramaFotografia(base, janela, [{ ...ocorrencia, clienteId: ids.planoId }])).toThrow();
  expect(() => comporCronogramaFotografia(base, janela, [{ ...ocorrencia, alvoId: ids.planoId }])).toThrow();
  expect(() => comporCronogramaFotografia(base, janela, [ocorrencia, ocorrencia])).toThrow();
  expect(() => comporCronogramaFotografia(base, janela, [{ ...ocorrencia, dataProgramada: undefined } as unknown as typeof ocorrencia])).toThrow();
});

it("não projeta Rotinas removidas ou datas fora da vigência e não inventa programação", () => {
  const fotografia = { ...base, rotinas: [base.rotinas[0]!], total: 1, vigenciaFim: "2026-12-31" };
  const resultado = comporCronogramaFotografia(fotografia, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: [] }, []);
  expect(resultado.baseline.map((item) => item.vencimento)).toEqual(["2026-12-25"]);
  expect(resultado.programacoes).toEqual([]);
  expect(resultado.rotinasVisitaSemProjecao).toEqual([]);
});

it("prepara conteúdo idêntico para PDF e planilha com limites de cobertura explícitos", () => {
  const resultado = comporCronogramaFotografia(base, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: ["2026-12-25"] }, [ocorrencia]);
  const linhas = linhasCronogramaFotografia(resultado);
  const pdf = textoCronogramaFotografia(resultado);
  for (const conteudo of [JSON.stringify(linhas), pdf]) {
    expect(conteudo).toContain("2026-12-25");
    expect(conteudo).toContain("2027-03-25");
    expect(conteudo).toContain("2027-01-03");
    expect(conteudo).toContain("cobertura desconhecida");
    expect(conteudo).toContain("execução não incluída");
    expect(conteudo).toContain("feriados informados: 2026-12-25");
    expect(conteudo).toContain("Datas manuais; declarações não consultadas");
  }
  expect(linhas.map((r) => r[0])).toContain("baseline calendário");
  expect(linhas.map((r) => r[0])).toContain("programação informada");
});

it("gera PDF e XLSX reais sem converter informação em fórmula", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  try {
    const resultado = comporCronogramaFotografia({ ...base, planoNome: "=1+1" }, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: ["2026-12-25"] }, [ocorrencia]);
    const pdf = await gerarPdfCronogramaFotografia(resultado);
    const xlsx = await gerarXlsxCronogramaFotografia(resultado);
    expect(pdf.type).toBe("application/pdf");
    expect((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
    const zip = unzipSync(new Uint8Array(await xlsx.arrayBuffer()));
    expect(strFromU8(zip["xl/sharedStrings.xml"]!)).toContain("=1+1");
    expect(strFromU8(zip["xl/worksheets/sheet1.xml"]!)).not.toMatch(/<f(?:\s|>)/);
  } finally { vi.unstubAllGlobals(); }
});

it("lê fonte parcial com identidade e estado da Visita sem tratá-la como execução", async () => {
  const rotinaVisita = base.rotinas[1]!;
  const linha = { ...ocorrencia, tipo: "visita", rotinaId: rotinaVisita.id, dataProgramada: null, visitaEstado: "cancelada", visitaRevisao: 4, snapshotHash: base.snapshotHash, completude: "desconhecida" };
  const resultado = await lerFonteCronogramaFotografia(async () => [linha], base);
  expect(resultado).toEqual([linha]);
  const cronograma = comporCronogramaFotografia(base, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: [] }, resultado);
  expect(textoCronogramaFotografia(cronograma)).toContain("cancelada");
  expect(cronograma.execucaoIncluida).toBe(false);
});

it("recusa fonte de outra fotografia ou Visita cancelada com data ativa", async () => {
  const rotinaVisita = base.rotinas[1]!;
  const linha = { ...ocorrencia, tipo: "visita", rotinaId: rotinaVisita.id, dataProgramada: null, visitaEstado: "cancelada", visitaRevisao: 4, snapshotHash: base.snapshotHash, completude: "desconhecida" };
  await expect(lerFonteCronogramaFotografia(async () => [{ ...linha, snapshotHash: "b".repeat(32) }], base)).rejects.toThrow();
  await expect(lerFonteCronogramaFotografia(async () => [{ ...linha, dataProgramada: "2027-01-03" }], base)).rejects.toThrow();
  await expect(lerFonteCronogramaFotografia(async () => [{ ...linha, rotinaId }], base)).rejects.toThrow();
});

it("gera cronograma somente após reconferir fotografia e ocorrências", async () => {
  const foto = vi.fn(async () => ({ ...base, posicao: 0, proximaPosicao: null }));
  const fonte = vi.fn(async () => [{ ...ocorrencia, tipo: "calendario", dataProgramada: null, visitaEstado: null, visitaRevisao: null, snapshotHash: base.snapshotHash, completude: "desconhecida" }]);
  const arquivo = await prepararExportacaoCronograma(foto, fonte, ids, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: [] }, gerarXlsxCronogramaFotografia);
  expect(arquivo.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect(foto).toHaveBeenCalledTimes(2);
  expect(fonte).toHaveBeenCalledTimes(2);
});

it("não entrega arquivo se uma ocorrência muda durante geração", async () => {
  const foto = async () => ({ ...base, posicao: 0, proximaPosicao: null });
  let chamadas = 0;
  const fonte = async () => [{ ...ocorrencia, tipo: "calendario", vencimentoOriginal: ++chamadas === 1 ? "2026-12-25" : "2026-12-26", dataProgramada: null, visitaEstado: null, visitaRevisao: null, snapshotHash: base.snapshotHash, completude: "desconhecida" }];
  await expect(prepararExportacaoCronograma(foto, fonte, ids, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: [] }, gerarXlsxCronogramaFotografia)).rejects.toThrow("Fonte alterada");
});

it("aplica filtro de modo ao baseline e às ocorrências, registrando o filtro", async () => {
  const foto = async () => ({ ...base, posicao: 0, proximaPosicao: null });
  const fonte = async () => [
    { ...ocorrencia, tipo: "calendario", dataProgramada: null, visitaEstado: null, visitaRevisao: null, snapshotHash: base.snapshotHash, completude: "desconhecida" },
    { ...ocorrencia, id: "30000000-0000-4000-8000-000000000002", tipo: "visita", rotinaId: base.rotinas[1]!.id, dataProgramada: "2027-01-03", visitaEstado: "confirmada", visitaRevisao: 1, snapshotHash: base.snapshotHash, completude: "desconhecida" },
  ];
  const arquivo = await prepararExportacaoCronograma(foto, fonte, ids, { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: [] }, async (dados) => new Blob([textoCronogramaFotografia(dados)]), { modo: "visita" });
  const texto = await arquivo.text();
  expect(texto).toContain("modo=visita");
  expect(texto).toContain("2027-01-03");
  expect(texto).not.toContain("baseline calendário");
  expect(texto).not.toContain(ocorrencia.id);
});

it("fixa janela, feriados e filtro antes das leituras assíncronas", async () => {
  const janela = { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: ["2026-12-25"] };
  const filtro: { modo: "visita" | "calendario" } = { modo: "calendario" };
  const foto = async () => { janela.feriadosInformados.length = 0; janela.fim = "2027-01-01"; filtro.modo = "visita"; return { ...base, posicao: 0, proximaPosicao: null }; };
  const arquivo = await prepararExportacaoCronograma(foto, async () => [], ids, janela, async (dados) => new Blob([textoCronogramaFotografia(dados)]), filtro);
  const texto = await arquivo.text();
  expect(texto).toContain("modo=calendario");
  expect(texto).toContain("2027-03-25");
  expect(texto).toContain("2026-12-25");
});

it("rejeita fotografia de outro Cliente quando identidade de entrada muda durante a leitura", async () => {
  const identidade = { ...ids };
  const outroCliente = "00000000-0000-4000-8000-000000000099";
  const foto = async () => {
    identidade.clienteId = outroCliente;
    return { ...base, clienteId: outroCliente, posicao: 0, proximaPosicao: null };
  };
  await expect(prepararExportacaoCronograma(foto, async () => [], identidade,
    { inicio: "2026-12-01", fim: "2027-04-01", feriadosInformados: [] },
    async () => new Blob(["não deveria ser entregue"]))).rejects.toThrow("Identidade de fotografia divergente");
});
