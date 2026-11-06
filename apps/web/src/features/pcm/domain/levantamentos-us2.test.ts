import { describe, expect, it } from "vitest";
import { preverDependenciasLevantamento } from "./levantamentos";

describe("prévia de dependências de levantamento", () => {
  it("bloqueia descendentes de pai rejeitado e mantém linhas independentes", () => {
    const resultado = preverDependenciasLevantamento(
      [
        { id: "area", estado: "rejeitada", dependencias: [] },
        { id: "local", estado: "em_conferencia", dependencias: ["area"] },
        { id: "sistema", estado: "em_conferencia", dependencias: ["local"] },
        { id: "livre", estado: "em_conferencia", dependencias: [] },
      ],
      ["local", "sistema", "livre"],
    );
    expect(resultado.elegiveis).toEqual(["livre"]);
    expect(resultado.bloqueadas).toEqual([
      { id: "local", motivo: "dependencia_nao_aprovada", dependencia: "area" },
      { id: "sistema", motivo: "dependencia_bloqueada", dependencia: "local" },
    ]);
  });

  it("ordena dependências selecionadas e aceita dependências já aprovadas", () => {
    expect(
      preverDependenciasLevantamento(
        [
          { id: "sistema", estado: "em_conferencia", dependencias: ["local"] },
          { id: "local", estado: "em_conferencia", dependencias: ["area"] },
          { id: "area", estado: "aprovada", dependencias: [] },
        ],
        ["sistema", "local"],
      ).elegiveis,
    ).toEqual(["local", "sistema"]);
  });

  it("não aceita referência ausente, pendente fora da seleção ou ciclo", () => {
    const resultado = preverDependenciasLevantamento(
      [
        { id: "sem-pai", estado: "em_conferencia", dependencias: ["ausente"] },
        { id: "pendente", estado: "em_conferencia", dependencias: [] },
        { id: "filho", estado: "em_conferencia", dependencias: ["pendente"] },
        { id: "a", estado: "em_conferencia", dependencias: ["b"] },
        { id: "b", estado: "em_conferencia", dependencias: ["a"] },
      ],
      ["sem-pai", "filho", "a", "b"],
    );
    expect(resultado.elegiveis).toEqual([]);
    expect(resultado.bloqueadas.map((linha) => linha.id).sort()).toEqual([
      "a",
      "b",
      "filho",
      "sem-pai",
    ]);
    expect(resultado.bloqueadas.find((linha) => linha.id === "sem-pai")?.motivo).toBe(
      "referencia_ausente",
    );
    expect(resultado.bloqueadas.find((linha) => linha.id === "filho")?.motivo).toBe(
      "dependencia_nao_aprovada",
    );
  });

  it("recusa identidades duplicadas, seleção inexistente ou linha rejeitada", () => {
    const linha = { id: "x", estado: "em_conferencia" as const, dependencias: [] };
    expect(() => preverDependenciasLevantamento([linha, linha], ["x"])).toThrow();
    expect(() => preverDependenciasLevantamento([linha], ["y"])).toThrow();
    expect(() =>
      preverDependenciasLevantamento([{ ...linha, estado: "rejeitada" }], ["x"]),
    ).toThrow();
    expect(() => preverDependenciasLevantamento([linha], ["x", "x"])).toThrow();
  });

  it("não altera linhas nem a seleção ao preparar a prévia", () => {
    const linhas = Object.freeze([
      Object.freeze({
        id: "a",
        estado: "em_conferencia" as const,
        dependencias: Object.freeze([] as string[]),
      }),
      Object.freeze({
        id: "b",
        estado: "em_conferencia" as const,
        dependencias: Object.freeze(["a"]),
      }),
    ]);
    const selecao = Object.freeze(["b", "a"]);
    expect(preverDependenciasLevantamento(linhas, selecao).elegiveis).toEqual(["a", "b"]);
    expect(selecao).toEqual(["b", "a"]);
    expect(linhas[1]?.dependencias).toEqual(["a"]);
  });

  it("processa cadeia longa sem recursão e sem alterar ordem hierárquica", () => {
    const linhas = Array.from({ length: 10000 }, (_, i) => ({
      id: String(i),
      estado: "em_conferencia" as const,
      dependencias: i === 0 ? [] : [String(i - 1)],
    }));
    const resultado = preverDependenciasLevantamento(
      linhas,
      linhas.map((linha) => linha.id).reverse(),
    );
    expect(resultado.bloqueadas).toEqual([]);
    expect(resultado.elegiveis).toHaveLength(10000);
    expect(resultado.elegiveis[0]).toBe("0");
    expect(resultado.elegiveis.at(-1)).toBe("9999");
  });
});
