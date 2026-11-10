import { describe, expect, it } from "vitest";
import { haSobreposicaoIntervalos } from "./sobreposicao-intervalos";
describe("intervalos declarados", () => {
  it("detecta sobreposição entre ausência e reserva independentemente da ordem", () => {
    expect(
      haSobreposicaoIntervalos([
        { inicio: "2026-01-01T11:00:00Z", fim: "2026-01-01T12:30:00Z" },
        { inicio: "2026-01-01T10:00:00Z", fim: "2026-01-01T12:00:00Z" },
      ]),
    ).toBe(true);
  });
  it("não considera encontro em fronteira como sobreposição", () => {
    expect(
      haSobreposicaoIntervalos([
        { inicio: "2026-01-01T10:00:00Z", fim: "2026-01-01T11:00:00Z" },
        { inicio: "2026-01-01T11:00:00Z", fim: "2026-01-01T12:00:00Z" },
      ]),
    ).toBe(false);
  });
  it("recusa horários inválidos ou sem fuso explícito", () => {
    expect(() =>
      haSobreposicaoIntervalos([{ inicio: "2026-01-01T10:00:00", fim: "2026-01-01T11:00:00Z" }]),
    ).toThrow();
    expect(() =>
      haSobreposicaoIntervalos([{ inicio: "2026-01-01T12:00:00Z", fim: "2026-01-01T11:00:00Z" }]),
    ).toThrow();
  });
});
