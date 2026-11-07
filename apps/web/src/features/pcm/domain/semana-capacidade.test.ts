import { describe, expect, it } from "vitest";
import { semanaCapacidade } from "./semana-capacidade";

describe("semana de capacidade", () => {
  it.each([
    ["2026-12-31", { inicio: "2026-12-28", fim: "2027-01-03" }],
    ["2027-01-03", { inicio: "2026-12-28", fim: "2027-01-03" }],
    ["2027-01-04", { inicio: "2027-01-04", fim: "2027-01-10" }],
    ["2024-02-29", { inicio: "2024-02-26", fim: "2024-03-03" }],
  ])("inclui segunda a domingo para %s", (data, esperado) => {
    expect(semanaCapacidade(data)).toEqual(esperado);
  });
  it.each(["", "2026-02-30", "2026-1-01", "abcd-12-01"])("recusa data inválida %s", (data) => {
    expect(semanaCapacidade(data)).toBeNull();
  });
});
