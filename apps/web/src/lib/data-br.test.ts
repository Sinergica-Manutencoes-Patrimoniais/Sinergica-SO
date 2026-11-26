import { describe, expect, it } from "vitest";
import { formatarDataBr } from "./data-br";

describe("formatarDataBr", () => {
  it("mantém o dia de uma coluna date, sem recuar por fuso (DEF-31/DEF-44)", () => {
    expect(formatarDataBr("2026-11-25")).toBe("25/11/2026");
  });

  it("mantém o dia em virada de ano", () => {
    expect(formatarDataBr("2027-01-01")).toBe("01/01/2027");
  });

  it("formata timestamp com hora pelo fuso local", () => {
    const esperado = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date("2026-11-25T12:00:00Z"));
    expect(formatarDataBr("2026-11-25T12:00:00Z")).toBe(esperado);
  });

  it("vazio vira travessão", () => {
    expect(formatarDataBr(null)).toBe("—");
    expect(formatarDataBr("")).toBe("—");
  });

  it("valor inválido é devolvido como veio", () => {
    expect(formatarDataBr("sem data")).toBe("sem data");
  });
});
