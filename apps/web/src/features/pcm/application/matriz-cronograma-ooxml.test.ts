import { expect, it } from "vitest";
import { matrizCronogramaOoxml } from "./matriz-cronograma-ooxml";
import type { CelulaOoxml } from "./aba-ooxml";

const celula = (linha: number, coluna: number, tipo: CelulaOoxml["tipo"], valor: string | null, formula: string | null = null): CelulaOoxml => ({ referencia: `A${linha}`, linha, coluna, tipo, valor, estilo: null, formula });

it("mantém posições e converte apenas datas de semanas pelo sistema 1904", () => {
  const resultado = matrizCronogramaOoxml([
    celula(3, 13, "texto", "S01"), celula(4, 13, "numero", "1"),
    celula(5, 2, "numero", "30"), celula(5, 4, "texto", "VRF"),
  ], true);
  expect(resultado.matriz[3]?.[12]).toBe("1904-01-02");
  expect(resultado.matriz[4]?.[1]).toBe(30);
  expect(resultado.matriz[4]?.[2]).toBeNull();
  expect(resultado.matriz[4]?.[3]).toBe("VRF");
});

it("sinaliza fórmulas e erros sem convertê-los em dados confiáveis", () => {
  const resultado = matrizCronogramaOoxml([celula(5, 1, "numero", "7", "1+6"), celula(5, 2, "erro", "#DIV/0!")], false);
  expect(resultado.matriz[4]).toEqual([null, null]);
  expect(resultado.pendencias).toEqual([{ referencia: "A5", motivo: "formula" }, { referencia: "A5", motivo: "erro" }]);
});

it("recusa serial fictício de 1900 e número não finito", () => {
  expect(() => matrizCronogramaOoxml([celula(3, 13, "texto", "S01"), celula(4, 13, "numero", "60")], false)).toThrow();
  expect(() => matrizCronogramaOoxml([celula(5, 1, "numero", "1e999")], false)).toThrow();
});

it("considera somente o dia quando a semana tem hora fracionária no Excel", () => {
  const resultado = matrizCronogramaOoxml([celula(3, 13, "texto", "S01"), celula(4, 13, "numero", "46029.625")], false);
  expect(resultado.matriz[3]?.[12]).toBe("2026-01-07");
});

it("recusa coordenadas duplicadas antes de sobrescrever a matriz", () => {
  expect(() => matrizCronogramaOoxml([celula(5, 1, "texto", "A"), celula(5, 1, "texto", "B")], false)).toThrow();
});

it("limita expansão de matriz esparsa antes de alocar posições vazias", () => {
  const dados = Array.from({ length: 500 }, (_, i) => celula(i + 1, 500, "texto", "x"));
  expect(() => matrizCronogramaOoxml(dados, false)).toThrow();
});
