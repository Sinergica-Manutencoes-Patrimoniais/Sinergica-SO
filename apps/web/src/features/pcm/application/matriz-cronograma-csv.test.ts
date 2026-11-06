import { describe, expect, it } from "vitest";
import { lerMatrizCronogramaCsv } from "./matriz-cronograma-csv";

describe("matriz de cronograma CSV", () => {
  it("preserva células, linhas vazias, zeros e aspas sem inferir tipos", () => {
    expect(lerMatrizCronogramaCsv('\uFEFFCódigo;Nome;Tempo\r\n001;"VRF; Torre";0\r\n;;\r\n"A""B";"linha\nseguinte";')).toEqual([
      ["Código", "Nome", "Tempo"], ["001", "VRF; Torre", "0"], ["", "", ""], ['A"B', "linha\nseguinte", ""],
    ]);
  });
  it("não aceita aspas inválidas ou arquivo grande", () => {
    expect(() => lerMatrizCronogramaCsv('a;"não fechado')).toThrow();
    expect(() => lerMatrizCronogramaCsv('a;"ok"extra')).toThrow();
    expect(() => lerMatrizCronogramaCsv("x".repeat(1_048_577))).toThrow();
  });
  it("respeita limites de linhas e colunas sem truncar", () => {
    expect(() => lerMatrizCronogramaCsv(Array(501).fill("x").join(";"))).toThrow();
    expect(() => lerMatrizCronogramaCsv(Array(10001).fill("x").join("\n"))).toThrow();
  });
});
