import { describe, expect, it } from "vitest";
import {
  agruparEventosPorData,
  diasSemanaIso,
  filtrarEventosPeriodo,
  fimMesIso,
  inicioMesIso,
  inicioSemanaIso,
  resumirClientesMensal,
} from "./planejamento-pcm";
import type { EventoAgendaPcm } from "./planejamento-pcm";

const eventos: EventoAgendaPcm[] = [
  {
    id: "os-1",
    tipo: "os",
    dataIso: "2026-07-06",
    titulo: "OS preventiva",
    clienteNome: "A",
    clienteId: "a",
    status: "planejamento",
    responsavel: null,
  },
  {
    id: "insp-1",
    tipo: "inspecao",
    dataIso: "2026-07-08",
    titulo: "Inspeção",
    clienteNome: "A",
    clienteId: "a",
    status: "em_andamento",
    responsavel: "João",
  },
  {
    id: "pmoc-1",
    tipo: "pmoc",
    dataIso: "2026-08-01",
    titulo: "PMOC mensal",
    clienteNome: "B",
    clienteId: "b",
    status: "agendado",
    responsavel: null,
  },
];

describe("planejamento-pcm", () => {
  it("calcula semana operacional de segunda a domingo", () => {
    expect(inicioSemanaIso("2026-07-06")).toBe("2026-07-06");
    expect(inicioSemanaIso("2026-07-12")).toBe("2026-07-06");
    expect(diasSemanaIso("2026-07-06")).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
  });

  it("filtra eventos por período, cliente e termo", () => {
    expect(
      filtrarEventosPeriodo(eventos, {
        inicioIso: "2026-07-01",
        fimIso: "2026-07-31",
        clienteId: "a",
        termo: "preventiva",
      }).map((evento) => evento.id),
    ).toEqual(["os-1"]);
  });

  it("agrupa e resume eventos mensais por cliente", () => {
    const grupos = agruparEventosPorData(eventos);
    expect(grupos.get("2026-07-06")?.[0]?.id).toBe("os-1");
    expect(resumirClientesMensal(eventos)[0]).toMatchObject({
      clienteNome: "A",
      totalEventos: 2,
      ordens: 1,
      inspecoes: 1,
    });
  });

  it("calcula limites do mês", () => {
    expect(inicioMesIso(2026, 1)).toBe("2026-02-01");
    expect(fimMesIso(2026, 1)).toBe("2026-02-28");
  });
});
