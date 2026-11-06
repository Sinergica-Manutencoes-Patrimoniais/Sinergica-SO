import { describe, expect, it } from "vitest";
import { calcularDisponibilidade, calcularEsforcoEstimado } from "./capacidade-agenda";

describe("disponibilidade destinada à operação", () => {
  it("desconta reservas e ausências informadas e preserva os parâmetros", () => {
    expect(
      calcularDisponibilidade({
        destinadosMinutos: 720,
        reservasMinutos: 60,
        ausenciasMinutos: 120,
      }),
    ).toEqual({
      destinadosMinutos: 720,
      reservasMinutos: 60,
      ausenciasMinutos: 120,
      disponiveisMinutos: 540,
    });
  });
  it("não inventa disponibilidade quando falta algum parâmetro", () => {
    expect(
      calcularDisponibilidade({
        destinadosMinutos: 720,
        reservasMinutos: null,
        ausenciasMinutos: 0,
      }).disponiveisMinutos,
    ).toBeNull();
  });
  it("rejeita parâmetros inválidos ou descontos maiores que o tempo destinado", () => {
    expect(() =>
      calcularDisponibilidade({
        destinadosMinutos: 100,
        reservasMinutos: 60,
        ausenciasMinutos: 41,
      }),
    ).toThrow();
    expect(() =>
      calcularDisponibilidade({ destinadosMinutos: 100, reservasMinutos: -1, ausenciasMinutos: 0 }),
    ).toThrow();
    expect(() =>
      calcularDisponibilidade({
        destinadosMinutos: 100,
        reservasMinutos: 0.5,
        ausenciasMinutos: 0,
      }),
    ).toThrow();
  });
});

describe("estimativa de esforço da agenda", () => {
  it("multiplica duração por técnicos e quantidade apenas para estimativa por unidade", () => {
    expect(
      calcularEsforcoEstimado({
        duracaoMinutos: 120,
        tecnicos: 2,
        quantidade: 3,
        tipoTempo: "por_unidade",
      }),
    ).toBe(720);
    expect(
      calcularEsforcoEstimado({
        duracaoMinutos: 120,
        tecnicos: 2,
        quantidade: 3,
        tipoTempo: "total",
      }),
    ).toBe(240);
    expect(
      calcularEsforcoEstimado({
        duracaoMinutos: 120,
        tecnicos: 2,
        quantidade: null,
        tipoTempo: "total",
      }),
    ).toBe(240);
  });
  it("mantém esforço desconhecido se duração, técnicos, quantidade necessária ou unidade faltarem", () => {
    const base = {
      duracaoMinutos: 120,
      tecnicos: 2,
      quantidade: 3,
      tipoTempo: "por_unidade" as const,
    };
    expect(calcularEsforcoEstimado({ ...base, duracaoMinutos: null })).toBeNull();
    expect(calcularEsforcoEstimado({ ...base, duracaoMinutos: 0 })).toBeNull();
    expect(calcularEsforcoEstimado({ ...base, tecnicos: 0 })).toBeNull();
    expect(calcularEsforcoEstimado({ ...base, quantidade: null })).toBeNull();
    expect(calcularEsforcoEstimado({ ...base, tipoTempo: null })).toBeNull();
  });
  it("rejeita números inválidos e estouro de precisão", () => {
    const base = {
      duracaoMinutos: 120,
      tecnicos: 2,
      quantidade: 3,
      tipoTempo: "por_unidade" as const,
    };
    expect(() => calcularEsforcoEstimado({ ...base, tecnicos: -1 })).toThrow();
    expect(() => calcularEsforcoEstimado({ ...base, duracaoMinutos: 1.5 })).toThrow();
    expect(() =>
      calcularEsforcoEstimado({ ...base, duracaoMinutos: Number.MAX_SAFE_INTEGER }),
    ).toThrow();
  });
  it("rejeita tipo de tempo desconhecido em vez de tratá-lo como total", () => {
    expect(() =>
      calcularEsforcoEstimado({
        duracaoMinutos: 120,
        tecnicos: 2,
        quantidade: 3,
        tipoTempo: "desconhecido" as never,
      }),
    ).toThrow("Estimativa inválida.");
  });
});
