import { describe, expect, it } from "vitest";
import { calcularPrazoSlaOs, calcularPrioridadeHub, inferirTipoOsHub } from "./hub-os";

describe("hub-os — inferirTipoOsHub (AC-1)", () => {
  it("mapeia cada categoria pro tipo correto", () => {
    expect(inferirTipoOsHub("emergencial", null)).toBe("C1");
    expect(inferirTipoOsHub("corretiva", null)).toBe("C2");
    expect(inferirTipoOsHub("inspecao", null)).toBe("IN");
  });

  it("preventiva vira P1 com pmocScheduleId, P2 sem", () => {
    expect(inferirTipoOsHub("preventiva", "schedule-1")).toBe("P1");
    expect(inferirTipoOsHub("preventiva", null)).toBe("P2");
  });

  it("melhoria e outro ficam fora do Hub", () => {
    expect(inferirTipoOsHub("melhoria", null)).toBeNull();
    expect(inferirTipoOsHub("outro", null)).toBeNull();
  });
});

describe("hub-os — calcularPrioridadeHub (AC-2)", () => {
  const hoje = new Date("2026-07-20T12:00:00Z");

  it("C1=1, C2=2, P2=3, IN=4", () => {
    expect(calcularPrioridadeHub("C1", null, hoje)).toBe(1);
    expect(calcularPrioridadeHub("C2", null, hoje)).toBe(2);
    expect(calcularPrioridadeHub("P2", null, hoje)).toBe(3);
    expect(calcularPrioridadeHub("IN", null, hoje)).toBe(4);
  });

  it("P1 no prazo = 3, P1 atrasada = 2 (risco legal)", () => {
    expect(calcularPrioridadeHub("P1", "2026-07-25T00:00:00Z", hoje)).toBe(3);
    expect(calcularPrioridadeHub("P1", "2026-07-10T00:00:00Z", hoje)).toBe(2);
  });

  it("P1 sem data_agendada nunca conta como atrasada (borda)", () => {
    expect(calcularPrioridadeHub("P1", null, hoje)).toBe(3);
  });

  it("sem tipoOs fica fora do Hub (null)", () => {
    expect(calcularPrioridadeHub(null, null, hoje)).toBeNull();
  });
});

describe("hub-os — calcularPrazoSlaOs (AC-3)", () => {
  it("C1 = 4h, C2 = 72h desde created_at", () => {
    const criado = "2026-07-20T10:00:00.000Z";
    expect(calcularPrazoSlaOs("C1", criado, null)).toMatchObject({
      deadline: "2026-07-20T14:00:00.000Z",
      descricao: "4h",
    });
    expect(calcularPrazoSlaOs("C2", criado, null)).toMatchObject({
      deadline: "2026-07-23T10:00:00.000Z",
      descricao: "72h",
    });
  });

  it("P1/P2 usam janela em torno de data_agendada", () => {
    const agendada = "2026-08-01T00:00:00.000Z";
    expect(calcularPrazoSlaOs("P1", "2026-07-20T00:00:00Z", agendada).deadline).toBe(
      "2026-08-04T00:00:00.000Z",
    );
    expect(calcularPrazoSlaOs("P2", "2026-07-20T00:00:00Z", agendada).deadline).toBe(
      "2026-08-08T00:00:00.000Z",
    );
  });

  it("P1/P2/IN sem data_agendada ficam sem deadline, mas não lançam (borda)", () => {
    expect(calcularPrazoSlaOs("P1", "2026-07-20T00:00:00Z", null).deadline).toBeNull();
    expect(calcularPrazoSlaOs("IN", "2026-07-20T00:00:00Z", null).deadline).toBeNull();
  });

  it("sem tipoOs = fora do Hub, sem prazo", () => {
    expect(calcularPrazoSlaOs(null, "2026-07-20T00:00:00Z", null)).toMatchObject({
      deadline: null,
      descricao: "fora do Hub",
    });
  });
});
