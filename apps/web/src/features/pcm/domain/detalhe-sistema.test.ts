import { describe, expect, it } from "vitest";
import { agregarOsSistema, separarOsSistema, ultimaManutencaoSistema } from "./detalhe-sistema";

const os = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  numero: `CH-${id}`,
  titulo: "Teste",
  status: "planejamento",
  prioridade: null,
  tecnicoNome: null,
  dataAgendada: "2026-10-03T10:00:00Z",
  concluidaEm: null,
  atualizadaEm: "2026-10-02T10:00:00Z",
  auvoTaskId: null,
  origens: [{ tipo: "sistema" as const, nome: "Sistema de incêndio" }],
  ...overrides,
});

describe("detalhe de Sistema — E01-S162", () => {
  it("deduplica uma OS ligada ao Sistema e ao Componente preservando as duas origens", () => {
    const resultado = agregarOsSistema([
      os("1"),
      os("1", { origens: [{ tipo: "componente", id: "c-1", nome: "Bomba 1" }] }),
    ]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.origens).toEqual([
      { tipo: "sistema", nome: "Sistema de incêndio" },
      { tipo: "componente", id: "c-1", nome: "Bomba 1" },
    ]);
  });

  it("preserva duas origens de componentes distintos mesmo quando seus nomes são iguais", () => {
    const resultado = agregarOsSistema([
      os("1", { origens: [{ tipo: "componente", id: "c-1", nome: "Bomba" }] }),
      os("1", { origens: [{ tipo: "componente", id: "c-2", nome: "Bomba" }] }),
    ]);

    expect(resultado[0]?.origens).toEqual([
      { tipo: "componente", id: "c-1", nome: "Bomba" },
      { tipo: "componente", id: "c-2", nome: "Bomba" },
    ]);
  });

  it("separa OS abertas do histórico finalizado/cancelado", () => {
    const resultado = separarOsSistema([
      os("aberta"),
      os("cancelada", { status: "cancelado" }),
      os("finalizada", { status: "finalizado", concluidaEm: "2026-10-04T12:00:00Z" }),
    ]);
    expect(resultado.abertas.map((item) => item.id)).toEqual(["aberta"]);
    expect(resultado.historico.map((item) => item.id)).toEqual(["finalizada", "cancelada"]);
  });

  it("usa somente check-out de OS finalizada para a última manutenção", () => {
    expect(
      ultimaManutencaoSistema([
        os("agenda-recente", { dataAgendada: "2026-12-01T10:00:00Z" }),
        os("cancelada", { status: "cancelado", concluidaEm: "2026-12-10T10:00:00Z" }),
        os("sem-execucao", { status: "finalizado" }),
        os("executada", { status: "finalizado", concluidaEm: "2026-10-03T10:00:00Z" }),
      ]),
    ).toBe("2026-10-03T10:00:00Z");
  });
});
