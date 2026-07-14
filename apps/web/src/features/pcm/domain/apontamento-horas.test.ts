import { describe, expect, it } from "vitest";
import {
  type ApontamentoHorasItem,
  agregarPorCliente,
  agregarPorTecnico,
  calcularCusto,
  calcularHorasOs,
  filtrarApontamentos,
} from "./apontamento-horas";

function item(overrides: Partial<ApontamentoHorasItem> = {}): ApontamentoHorasItem {
  return {
    osId: "os1",
    osNumero: "CH-001",
    clienteId: "c1",
    clienteNome: "Cliente A",
    tecnicoFuncionarioId: "t1",
    tecnicoNome: "Técnico A",
    dataAgendada: "2026-07-10T00:00:00Z",
    checkInAt: null,
    checkOutAt: null,
    horas: 2,
    ...overrides,
  };
}

describe("apontamento-horas", () => {
  it("usa duracaoHoras quando presente (prioridade 1)", () => {
    expect(calcularHorasOs(3.5, "2026-07-10T08:00:00Z", "2026-07-10T12:00:00Z")).toBe(3.5);
  });

  it("cai pro diff de check-in/check-out quando duracaoHoras ausente", () => {
    expect(calcularHorasOs(null, "2026-07-10T08:00:00Z", "2026-07-10T10:30:00Z")).toBe(2.5);
  });

  it("retorna 0 sem duracaoHoras nem check-in/out completo (nunca some, aparece com 0)", () => {
    expect(calcularHorasOs(null, null, null)).toBe(0);
    expect(calcularHorasOs(null, "2026-07-10T08:00:00Z", null)).toBe(0);
  });

  it("ignora check-out anterior ao check-in (dado inconsistente)", () => {
    expect(calcularHorasOs(null, "2026-07-10T12:00:00Z", "2026-07-10T08:00:00Z")).toBe(0);
  });

  it("filtra por técnico e cliente", () => {
    const itens = [
      item({ osId: "os1", tecnicoFuncionarioId: "t1", clienteId: "c1" }),
      item({ osId: "os2", tecnicoFuncionarioId: "t2", clienteId: "c1" }),
    ];
    expect(
      filtrarApontamentos(itens, { inicio: "", fim: "", tecnicoFuncionarioId: "t1" }).map(
        (i) => i.osId,
      ),
    ).toEqual(["os1"]);
    expect(filtrarApontamentos(itens, { inicio: "", fim: "", clienteId: "c1" })).toHaveLength(2);
  });

  it("agrega horas por cliente, ordenado do maior pro menor", () => {
    const itens = [
      item({ osId: "os1", clienteId: "c1", clienteNome: "Cliente A", horas: 2 }),
      item({ osId: "os2", clienteId: "c1", clienteNome: "Cliente A", horas: 3 }),
      item({ osId: "os3", clienteId: "c2", clienteNome: "Cliente B", horas: 10 }),
    ];
    expect(agregarPorCliente(itens)).toEqual([
      { chave: "c2", nome: "Cliente B", totalHoras: 10, totalOs: 1 },
      { chave: "c1", nome: "Cliente A", totalHoras: 5, totalOs: 2 },
    ]);
  });

  it("agrega horas por técnico, agrupa sem-vínculo separadamente", () => {
    const itens = [
      item({ osId: "os1", tecnicoFuncionarioId: null, tecnicoNome: "", horas: 1 }),
      item({ osId: "os2", tecnicoFuncionarioId: "t1", tecnicoNome: "Técnico A", horas: 4 }),
    ];
    const agregado = agregarPorTecnico(itens);
    expect(agregado.find((a) => a.chave === "sem-vinculo")).toEqual({
      chave: "sem-vinculo",
      nome: "Sem técnico",
      totalHoras: 1,
      totalOs: 1,
    });
  });

  it("calcula custo só quando há valor/hora (E04-S06)", () => {
    expect(calcularCusto(10, 50)).toBe(500);
    expect(calcularCusto(10, null)).toBeNull();
    expect(calcularCusto(10, undefined)).toBeNull();
  });
});
