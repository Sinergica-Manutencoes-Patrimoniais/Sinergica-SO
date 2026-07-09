import { describe, expect, it } from "vitest";
import {
  agruparPorTecnico,
  calcularKpisOrdens,
  filtrarBacklogGut,
  formatarDiaIso,
  gerarDiasDoMes,
  ordenarBacklogGut,
  ordensNoDia,
} from "./ordens-servico";

const base = {
  id: "os",
  numero: "CH-001",
  titulo: "Teste",
  clienteNome: "Cliente",
  categoria: "corretiva",
  prioridade: "media",
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
  auvoTaskId: null,
  auvoSyncStatus: null,
  auvoSyncError: null,
  tecnicoFuncionarioId: null,
  tecnicoNome: null,
  dataAgendada: null,
  checkInAt: null,
  checkOutAt: null,
  detalhes: null,
};

describe("ordens-servico", () => {
  it("ordena backlog por score desc e desempata por data mais recente", () => {
    const ordens = [
      { id: "a", scorePcm: 20, createdAt: "2026-07-03T10:00:00Z" },
      { id: "b", scorePcm: 90, createdAt: "2026-07-02T10:00:00Z" },
      { id: "c", scorePcm: 90, createdAt: "2026-07-04T10:00:00Z" },
    ];

    expect(ordenarBacklogGut(ordens).map((ordem) => ordem.id)).toEqual(["c", "b", "a"]);
  });

  it("backlog exclui status históricos", () => {
    const ordens = [
      { id: "a", status: "solicitacao", scorePcm: 20, createdAt: "2026-07-03T10:00:00Z" },
      { id: "b", status: "finalizado", scorePcm: 125, createdAt: "2026-07-04T10:00:00Z" },
      { id: "c", status: "cancelado", scorePcm: 90, createdAt: "2026-07-04T09:00:00Z" },
    ];

    expect(filtrarBacklogGut(ordens).map((ordem) => ordem.id)).toEqual(["a"]);
  });

  it("calcula KPIs operacionais", () => {
    expect(
      calcularKpisOrdens([
        { ...base, id: "1", status: "solicitacao", scorePcm: 27, createdAt: "2026-07-04" },
        {
          ...base,
          id: "2",
          status: "planejamento",
          prioridade: "critica",
          scorePcm: 125,
          createdAt: "2026-07-04",
        },
        { ...base, id: "3", status: "finalizado", scorePcm: 8, createdAt: "2026-07-04" },
      ]),
    ).toEqual({
      total: 3,
      abertas: 2,
      emPlanejamento: 1,
      emExecucao: 0,
      finalizadas: 1,
      criticas: 1,
    });
  });

  it("agrupa por técnico — 'Sem técnico' sempre por último", () => {
    const grupos = agruparPorTecnico([
      { ...base, id: "1", tecnicoFuncionarioId: "tec-2", tecnicoNome: "Weslei" },
      { ...base, id: "2", tecnicoFuncionarioId: null },
      { ...base, id: "3", tecnicoFuncionarioId: "tec-1", tecnicoNome: "Fabrício" },
      { ...base, id: "4", tecnicoFuncionarioId: "tec-1", tecnicoNome: "Fabrício" },
    ] as never);

    expect(grupos.map((g) => g.tecnicoNome)).toEqual(["Fabrício", "Weslei", "Sem técnico"]);
    expect(grupos[0]?.ordens.map((o) => o.id)).toEqual(["3", "4"]);
    expect(grupos[2]?.ordens.map((o) => o.id)).toEqual(["2"]);
  });

  it("ordensNoDia — filtra por dataAgendada no dia informado", () => {
    const ordens = [
      { ...base, id: "1", dataAgendada: "2026-06-25T08:00:00" },
      { ...base, id: "2", dataAgendada: "2026-06-25T18:30:00" },
      { ...base, id: "3", dataAgendada: "2026-06-26T08:00:00" },
      { ...base, id: "4", dataAgendada: null },
    ] as never;

    expect(ordensNoDia(ordens, "2026-06-25").map((o: { id: string }) => o.id)).toEqual(["1", "2"]);
  });

  it("gerarDiasDoMes — grade de 42 dias (6 semanas) começando no domingo", () => {
    const dias = gerarDiasDoMes(2026, 5); // junho/2026 (mês 0-indexado)
    expect(dias).toHaveLength(42);
    const primeiroDia = dias[0];
    if (!primeiroDia) throw new Error("gerarDiasDoMes devolveu array vazio");
    expect(primeiroDia.getDay()).toBe(0);
    expect(formatarDiaIso(primeiroDia)).toBe("2026-05-31");
  });
});
