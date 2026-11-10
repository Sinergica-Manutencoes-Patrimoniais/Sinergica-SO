import { describe, expect, it, vi } from "vitest";
import { lerSnapshotExportacao, confirmarSnapshotExportacao } from "./snapshot-exportacao";

const clienteId = "00000000-0000-4000-8000-000000000001";
const planoId = "00000000-0000-4000-8000-000000000002";
const versaoId = "00000000-0000-4000-8000-000000000003";
const identidade = { clienteId, planoId, versaoId };
const rotina = (i: number) => ({ id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`, planoId, versaoId, nome: `Rotina ${i}`, alvoTipo: "sistema", alvoId: "20000000-0000-4000-8000-000000000001", alvoNome: "Bomba", modo: "calendario", intervalo: 1, unidade: "meses", dataBase: "2026-01-01", tempoMinutos: null, tipoTempo: null, toleranciaAntes: 0, toleranciaDepois: 0 });
const pagina = (posicao: number, total = 101) => ({ ...identidade, planoNome: "Nome aprovado", versaoNumero: 1, vigenciaInicio: "2026-01-01", vigenciaFim: null, snapshotHash: "a".repeat(32), total, posicao, proximaPosicao: posicao + 100 < total ? posicao + 100 : null, rotinas: Array.from({ length: Math.min(100, total - posicao) }, (_, i) => rotina(posicao + i)), capacidadeIncluida: false, cronogramaOperacionalIncluido: false });

describe("fotografia para exportação", () => {
  it("reúne todas as páginas coerentes preservando nomes aprovados", async () => {
    const obterPagina = vi.fn(async (posicao: number) => pagina(posicao));
    const snapshot = await lerSnapshotExportacao(obterPagina, identidade);
    expect(obterPagina.mock.calls.map(([p]) => p)).toEqual([0, 100]);
    expect(snapshot.planoNome).toBe("Nome aprovado");
    expect(snapshot.rotinas).toHaveLength(101);
    expect(snapshot.rotinas[100]?.nome).toBe("Rotina 100");
  });

  it("rejeita alteração de fotografia entre páginas", async () => {
    const obterPagina = async (posicao: number) => ({ ...pagina(posicao), snapshotHash: (posicao ? "b" : "a").repeat(32) });
    await expect(lerSnapshotExportacao(obterPagina, identidade)).rejects.toThrow();
  });

  it("rejeita paginação incompleta, duplicada ou de outro Cliente", async () => {
    const vazio = { ...pagina(0), rotinas: [] };
    await expect(lerSnapshotExportacao(async () => vazio, identidade)).rejects.toThrow();
    await expect(lerSnapshotExportacao(async (p) => p ? { ...pagina(p), rotinas: [rotina(0)] } : pagina(p), identidade)).rejects.toThrow();
    await expect(lerSnapshotExportacao(async (p) => ({ ...pagina(p), clienteId: versaoId }), identidade)).rejects.toThrow();
  });

  it("rejeita qualquer alteração do conteúdo na conferência final mesmo com hash igual", async () => {
    const aprovado = await lerSnapshotExportacao(async (p) => pagina(p, 1), identidade);
    await expect(confirmarSnapshotExportacao(async () => ({ ...pagina(0, 1), planoNome: "Alterado" }), identidade, aprovado)).rejects.toThrow();
    await expect(confirmarSnapshotExportacao(async (p) => pagina(p, 1), identidade, aprovado)).resolves.toBeUndefined();
  });

  it("rejeita dados malformados e interrupção antes de devolver fotografia", async () => {
    await expect(lerSnapshotExportacao(async () => ({ ...pagina(0, 1), rotinas: [{ ...rotina(0), intervalo: 1, unidade: null }] }), identidade)).rejects.toThrow();
    await expect(lerSnapshotExportacao(async () => ({ ...pagina(0, 1), cronogramaOperacionalIncluido: true }), identidade)).rejects.toThrow();
    const controlador = new AbortController();
    await expect(lerSnapshotExportacao(async () => { controlador.abort(); return pagina(0, 1); }, identidade, controlador.signal)).rejects.toThrow();
  });

  it("rejeita fotografia sem recorrência ou sem data-base de rotina por calendário", async () => {
    const semRecorrencia = { ...rotina(0), intervalo: null, unidade: null };
    await expect(lerSnapshotExportacao(async () => ({ ...pagina(0, 1), rotinas: [semRecorrencia] }), identidade)).rejects.toThrow();
    await expect(lerSnapshotExportacao(async () => ({ ...pagina(0, 1), rotinas: [{ ...rotina(0), dataBase: null }] }), identidade)).rejects.toThrow();
    await expect(lerSnapshotExportacao(async () => ({ ...pagina(0, 1), rotinas: [{ ...rotina(0), modo: "visita", dataBase: null }] }), identidade)).resolves.toBeDefined();
  });
});
