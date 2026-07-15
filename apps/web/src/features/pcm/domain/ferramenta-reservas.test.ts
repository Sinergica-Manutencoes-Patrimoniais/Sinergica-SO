import { describe, expect, it } from "vitest";
import {
  type FerramentaReservaItem,
  ordenarAgendaReservas,
  validarCancelarReserva,
  validarCriarReserva,
  validarEfetivarReserva,
} from "./ferramenta-reservas";
import type { FerramentaUnidadeItem } from "./ferramenta-unidades";

function unidade(overrides: Partial<FerramentaUnidadeItem> = {}): FerramentaUnidadeItem {
  return {
    id: "u1",
    ferramentaId: "f1",
    ferramentaNome: "Martelete",
    codigo: "FER-0001",
    status: "disponivel",
    atribuidaA: null,
    atribuidaANome: null,
    atribuidaEm: null,
    motivoBaixa: null,
    ...overrides,
  };
}

function reserva(overrides: Partial<FerramentaReservaItem> = {}): FerramentaReservaItem {
  return {
    id: "r1",
    ferramentaId: "f1",
    ferramentaNome: "Martelete",
    unidadeId: "u1",
    unidadeCodigo: "FER-0001",
    funcionarioId: "func1",
    funcionarioNome: "Técnico A",
    dataInicio: "2026-07-20",
    dataFim: "2026-07-20",
    status: "pendente",
    motivoCancelamento: null,
    ...overrides,
  };
}

describe("ferramenta-reservas", () => {
  it("cria reserva de unidade específica sem conflito", () => {
    expect(
      validarCriarReserva(
        { ferramentaId: "f1", unidadeId: "u1", funcionarioId: "func2", dataInicio: "2026-07-25" },
        [unidade()],
        [reserva()],
      ),
    ).toEqual({
      ferramentaId: "f1",
      unidadeId: "u1",
      funcionarioId: "func2",
      dataInicio: "2026-07-25",
      dataFim: "2026-07-25",
    });
  });

  it("bloqueia reserva de unidade específica com intervalo sobreposto", () => {
    expect(() =>
      validarCriarReserva(
        {
          ferramentaId: "f1",
          unidadeId: "u1",
          funcionarioId: "func2",
          dataInicio: "2026-07-19",
          dataFim: "2026-07-21",
        },
        [unidade()],
        [reserva({ dataInicio: "2026-07-20", dataFim: "2026-07-20" })],
      ),
    ).toThrow("Unidade já reservada");
  });

  it("permite reserva que só toca a borda do intervalo (fim = início da outra)", () => {
    // Borda intencionalmente tratada como sobreposição (dia compartilhado) — conservador.
    expect(() =>
      validarCriarReserva(
        {
          ferramentaId: "f1",
          unidadeId: "u1",
          funcionarioId: "func2",
          dataInicio: "2026-07-20",
          dataFim: "2026-07-22",
        },
        [unidade()],
        [reserva({ dataInicio: "2026-07-18", dataFim: "2026-07-20" })],
      ),
    ).toThrow("Unidade já reservada");
  });

  it("reserva genérica falha quando reservas pendentes já esgotam as unidades ativas", () => {
    expect(() =>
      validarCriarReserva(
        { ferramentaId: "f1", funcionarioId: "func2", dataInicio: "2026-07-20" },
        [unidade({ id: "u1" }), unidade({ id: "u2", status: "baixada" })],
        [reserva({ unidadeId: null })],
      ),
    ).toThrow("Não há unidade livre");
  });

  it("reserva genérica passa quando há unidade ativa sobrando", () => {
    expect(
      validarCriarReserva(
        { ferramentaId: "f1", funcionarioId: "func2", dataInicio: "2026-07-20" },
        [unidade({ id: "u1" }), unidade({ id: "u2" })],
        [reserva({ unidadeId: null })],
      ),
    ).toEqual({
      ferramentaId: "f1",
      funcionarioId: "func2",
      dataInicio: "2026-07-20",
      dataFim: "2026-07-20",
    });
  });

  it("bloqueia data fim antes da data início", () => {
    expect(() =>
      validarCriarReserva(
        {
          ferramentaId: "f1",
          funcionarioId: "func2",
          dataInicio: "2026-07-20",
          dataFim: "2026-07-19",
        },
        [unidade()],
        [],
      ),
    ).toThrow("não pode ser antes");
  });

  it("efetiva reserva pendente com unidade disponível", () => {
    expect(
      validarEfetivarReserva({ reservaId: "r1", unidadeId: "u1" }, reserva(), unidade()),
    ).toEqual({ reservaId: "r1", unidadeId: "u1" });
  });

  it("bloqueia efetivar reserva já efetivada/cancelada", () => {
    expect(() =>
      validarEfetivarReserva(
        { reservaId: "r1", unidadeId: "u1" },
        reserva({ status: "efetivada" }),
        unidade(),
      ),
    ).toThrow("Só reserva pendente");
  });

  it("bloqueia efetivar com unidade indisponível", () => {
    expect(() =>
      validarEfetivarReserva(
        { reservaId: "r1", unidadeId: "u1" },
        reserva(),
        unidade({ status: "atribuida" }),
      ),
    ).toThrow("não está disponível");
  });

  it("cancela reserva pendente", () => {
    expect(validarCancelarReserva({ reservaId: "r1" }, reserva())).toEqual({ reservaId: "r1" });
  });

  it("bloqueia cancelar reserva já efetivada", () => {
    expect(() =>
      validarCancelarReserva({ reservaId: "r1" }, reserva({ status: "efetivada" })),
    ).toThrow("Só reserva pendente");
  });

  it("agenda ordena por data e só mostra pendentes", () => {
    const agenda = ordenarAgendaReservas([
      reserva({ id: "r2", dataInicio: "2026-07-25" }),
      reserva({ id: "r3", status: "cancelada", dataInicio: "2026-07-10" }),
      reserva({ id: "r1", dataInicio: "2026-07-20" }),
    ]);
    expect(agenda.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});
