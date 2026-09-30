import { describe, expect, it } from "vitest";
import { sugerirSigla, sugerirSiglaUnica, validarSigla } from "./siglas";

describe("sugerirSigla", () => {
  const casosManterNumero = [
    ["Guainumbí", "GUA", null],
    ["Torre A", "TOA", null],
    ["2º Andar", "A02", null],
    ["Shaft", "SHA", null],
    ["Elétrica", "ELE", null],
    ["Sala 01", "S01", null],
    ["Sala 101", "S01", null],
    ["Casa de Máquinas", "CAM", null],
    ["Transporte Vertical", "TRV", null],
    ["PCI", "PCI", null],
    ["Ar", "ARX", null],
    ["Área Comum", "ARC", null],
    ["12", "012", null],
  ] as const;

  it.each(casosManterNumero)("%s (manterNumero) → %s", (nome, siglaEsperada, numeroEsperado) => {
    expect(sugerirSigla(nome, { manterNumero: true })).toEqual({
      sigla: siglaEsperada,
      numeroFinal: numeroEsperado,
    });
  });

  const casosSemManterNumero = [
    ["Quadro de Distribuição de Circuitos 01", "QDC", "01"],
    ["Ar Condicionado 2", "ARC", "02"],
    ["Hidrante 1", "HID", "01"],
    ["Sistema de Hidrante Torre A", "SHT", null],
  ] as const;

  it.each(casosSemManterNumero)(
    "%s (sem manterNumero) → %s / %s",
    (nome, siglaEsperada, numeroEsperado) => {
      expect(sugerirSigla(nome, { manterNumero: false })).toEqual({
        sigla: siglaEsperada,
        numeroFinal: numeroEsperado,
      });
    },
  );

  it("nome vazio lança erro", () => {
    expect(() => sugerirSigla("   ", { manterNumero: true })).toThrow(
      "Nome vazio ou sem caracteres válidos para gerar sigla.",
    );
  });

  it("número com 3+ dígitos não trunca o numeroFinal (só a sigla)", () => {
    expect(sugerirSigla("Bomba 101", { manterNumero: false })).toEqual({
      sigla: "BOM",
      numeroFinal: "101",
    });
  });
});

describe("sugerirSiglaUnica", () => {
  it("devolve a sigla sugerida quando livre", () => {
    expect(sugerirSiglaUnica("Torre A", new Set(), { manterNumero: true })).toBe("TOA");
  });

  it("desempata trocando o 3º caractere quando já em uso", () => {
    expect(sugerirSiglaUnica("Sala 01", new Set(["S01"]), { manterNumero: true })).toBe("S02");
  });

  it("pula candidatas já em uso até achar uma livre", () => {
    const emUso = new Set(["S01", "S02", "S03"]);
    expect(sugerirSiglaUnica("Sala 01", emUso, { manterNumero: true })).toBe("S04");
  });

  it("lança erro quando esgota o alfabeto de desempate", () => {
    const emUso = new Set(
      "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".split("").map((letra) => `S0${letra}`),
    );
    emUso.add("S01");
    expect(() => sugerirSiglaUnica("Sala 01", emUso, { manterNumero: true })).toThrow(
      "Não foi possível sugerir sigla única — informe manualmente.",
    );
  });
});

describe("validarSigla", () => {
  it("normaliza espaços e caixa", () => {
    expect(validarSigla(" ele ")).toBe("ELE");
  });

  it("aceita 3 dígitos", () => {
    expect(validarSigla("012")).toBe("012");
  });

  it.each(["EL", "ELEC", "EL-1", ""])("rejeita %s", (invalida) => {
    expect(() => validarSigla(invalida)).toThrow("Sigla deve ter exatamente 3 letras ou números.");
  });
});
