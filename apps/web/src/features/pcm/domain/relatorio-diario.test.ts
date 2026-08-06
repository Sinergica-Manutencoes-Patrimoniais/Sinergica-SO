import { describe, expect, it } from "vitest";
import { formatarTextoRelatorioDiario, montarResumoRelatorioDiario } from "./relatorio-diario";
import type { DadosRelatorioDiario } from "./relatorio-diario";

const base: DadosRelatorioDiario = {
  ordens: [
    {
      id: "os-1",
      createdAt: "2026-08-05T12:00:00Z",
      checkOutAt: "2026-08-05T18:00:00Z",
      dataAgendada: "2026-08-05",
      status: "finalizado",
      tecnicoFuncionarioId: "tec-1",
      tecnicoNome: "Ana",
      auvoTaskId: 32,
      tipoOs: "C1",
      numero: "CH-1",
      titulo: "x",
      descricao: null,
      clienteNome: "Cliente",
      categoria: "corretiva",
      prioridade: "alta",
      scorePcm: 0,
      gravidade: null,
      urgencia: null,
      tendencia: null,
      dorCliente: null,
      observacao: null,
      origemInspecaoItemId: null,
      auvoSyncStatus: null,
      auvoSyncError: null,
      checkInAt: "2026-08-05T16:00:00Z",
      detalhes: null,
      pmocScheduleId: null,
      chamadoId: null,
      localDescricao: null,
      solicitante: null,
      origem: "manual",
    },
    {
      id: "os-2",
      createdAt: "2026-08-01T12:00:00Z",
      checkOutAt: null,
      dataAgendada: "2026-08-04",
      status: "planejamento",
      tecnicoFuncionarioId: null,
      tecnicoNome: null,
      auvoTaskId: null,
      tipoOs: null,
      numero: "CH-2",
      titulo: "y",
      descricao: null,
      clienteNome: "Cliente",
      categoria: "corretiva",
      prioridade: "normal",
      scorePcm: 9,
      gravidade: null,
      urgencia: null,
      tendencia: null,
      dorCliente: null,
      observacao: null,
      origemInspecaoItemId: null,
      auvoSyncStatus: null,
      auvoSyncError: null,
      checkInAt: null,
      detalhes: null,
      pmocScheduleId: null,
      chamadoId: null,
      localDescricao: null,
      solicitante: null,
      origem: "manual",
    },
  ],
  chamados: [
    {
      id: "ch-1",
      numero: "CH-1",
      clienteId: "c-1",
      titulo: "x",
      descricao: null,
      local: null,
      origem: "manual",
      status: "aberto",
      solicitante: null,
      ordemServicoId: null,
      cancelamentoJustificativa: null,
      cancelamentoAnexoPath: null,
      createdAt: "2026-08-05T12:00:00Z",
      dataPlanejada: null,
      dataExecucao: null,
      replanejamentos: 0,
    },
  ],
  apontamentos: [
    {
      osId: "os-1",
      osNumero: "CH-1",
      clienteId: "c-1",
      clienteNome: "Cliente",
      tecnicoFuncionarioId: "tec-1",
      tecnicoNome: "Ana",
      dataAgendada: "2026-08-05",
      checkInAt: "2026-08-05T16:00:00Z",
      checkOutAt: "2026-08-05T18:00:00Z",
      horas: 2,
    },
  ],
  saudeSync: [{ entity: "task", errorCount: 2, pendingCount: 3 }],
};

describe("montarResumoRelatorioDiario", () => {
  it("consolida eventos, horas, atenção e saúde no dia local", () => {
    const resumo = montarResumoRelatorioDiario("2026-08-05", base);
    expect(resumo).toMatchObject({
      ordensAbertas: 1,
      ordensFinalizadas: 1,
      chamadosNovos: 1,
      horasApontadas: 2,
      emergenciais: 1,
      ordensAtrasadas: 1,
      ordensSemTecnico: 1,
      errosSyncAuvo: 2,
      pendenciasSyncAuvo: 3,
    });
    expect(resumo.porTecnico).toEqual([{ nome: "Ana", horas: 2, ordens: 1, auvoTaskIds: [32] }]);
    expect(formatarTextoRelatorioDiario(resumo)).toContain("Sync Auvo: 2 erro(s), 3 pendência(s)");
  });

  it("indica dia sem movimento e saúde indisponível", () => {
    const resumo = montarResumoRelatorioDiario("2026-08-06", { ...base, saudeSync: null });
    expect(resumo.semMovimento).toBe(true);
    expect(resumo.errosSyncAuvo).toBeNull();
  });
});
