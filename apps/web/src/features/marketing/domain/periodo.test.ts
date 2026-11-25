import { describe, expect, it } from "vitest";
import {
  diasDoPeriodo,
  mesAtual,
  periodoAnterior,
  problemaDoPeriodo,
  ultimosDias,
} from "./periodo";

describe("periodo (E06-S01)", () => {
  const hoje = new Date(2026, 10, 25); // 25/11/2026, calendário local

  it("AC-7: 'últimos 7 dias' inclui hoje", () => {
    expect(ultimosDias(7, hoje)).toEqual({ de: "2026-11-19", ate: "2026-11-25" });
  });

  it("AC-7: atravessa a virada de mês sem perder um dia", () => {
    expect(ultimosDias(30, hoje)).toEqual({ de: "2026-10-27", ate: "2026-11-25" });
  });

  it("AC-7: mês atual vai do dia 1 até hoje", () => {
    expect(mesAtual(hoje)).toEqual({ de: "2026-11-01", ate: "2026-11-25" });
  });

  it("conta os dois extremos: um único dia é 1 dia, não 0", () => {
    expect(diasDoPeriodo({ de: "2026-11-25", ate: "2026-11-25" })).toBe(1);
    expect(diasDoPeriodo({ de: "2026-11-19", ate: "2026-11-25" })).toBe(7);
  });

  it("AC-7: período anterior tem o mesmo tamanho e encosta no início", () => {
    const atual = { de: "2026-11-19", ate: "2026-11-25" };
    expect(periodoAnterior(atual)).toEqual({ de: "2026-11-12", ate: "2026-11-18" });
  });

  it("período anterior atravessa o início do ano", () => {
    expect(periodoAnterior({ de: "2027-01-01", ate: "2027-01-07" })).toEqual({
      de: "2026-12-25",
      ate: "2026-12-31",
    });
  });

  it("recusa data faltando, invertida ou janela longa demais", () => {
    expect(problemaDoPeriodo({ de: "", ate: "2026-11-25" })).toBe("Escolha as duas datas.");
    expect(problemaDoPeriodo({ de: "2026-11-25", ate: "2026-11-19" })).toBe(
      "A data final vem depois da inicial.",
    );
    expect(problemaDoPeriodo({ de: "2020-01-01", ate: "2026-11-25" })).toBe(
      "O período vai até 366 dias.",
    );
  });

  it("aceita o período válido sem reclamar", () => {
    expect(problemaDoPeriodo({ de: "2026-11-19", ate: "2026-11-25" })).toBeNull();
    // Exatamente no limite: 366 dias passa, 367 não.
    expect(problemaDoPeriodo({ de: "2026-01-01", ate: "2027-01-01" })).toBeNull();
    expect(problemaDoPeriodo({ de: "2026-01-01", ate: "2027-01-02" })).not.toBeNull();
  });
});
