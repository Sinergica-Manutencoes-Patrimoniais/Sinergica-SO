import { describe, expect, it } from "vitest";
import { calcularKpisOrdens, filtrarBacklogGut, ordenarBacklogGut } from "./ordens-servico";

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
});
