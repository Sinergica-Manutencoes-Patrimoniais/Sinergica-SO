import { expect, it } from "vitest";
import type { CelulaOoxml } from "./aba-ooxml";
import { previaCronogramaOoxml } from "./previa-cronograma-ooxml";

const cel = (linha: number, coluna: number, valor: string, formula: string | null = null): CelulaOoxml => ({ referencia: `R${linha}C${coluna}`, linha, coluna, tipo: "texto", valor, estilo: null, formula });
const cabecalho = ["CONDOMÍNIO", "NATUREZA", "ÁREA", "ANDAR", "LOCAL", "SISTEMA", "TIPO DE EQUIPAMENTO", "EQUIPAMENTO", "IDENTIFICAÇÃO", "PERIODICIDADE", "RESPONSÁVEL", "TEMPO MÉDIO / OS (MIN)"];
const dados = () => [...cabecalho.map((v, i) => cel(3, i + 1, v)), cel(3, 13, "S01"), cel(4, 13, "2026-08-05"), cel(5, 6, "SPCI"), cel(5, 9, "EX-01"), cel(5, 12, "30"), cel(5, 13, "X")];

it("reutiliza a conferência existente sem aprovar nem resolver alvo", () => {
  const resultado = previaCronogramaOoxml(dados(), false, "fonte", "cliente", [], {});
  expect(resultado.estado).toBe("conferivel");
  if (resultado.estado !== "conferivel") throw new Error("prévia bloqueada");
  expect(resultado.linhas).toHaveLength(1);
  expect(resultado.linhas[0]?.original.codigoOriginal).toBe("EX-01");
  expect(resultado.linhas[0]?.conferencia.erros).toContain("alvo_nao_encontrado");
});

it("bloqueia a conferência quando houver fórmula, mesmo com cache", () => {
  const entrada = dados().filter((c) => !(c.linha === 5 && c.coluna === 13));
  const resultado = previaCronogramaOoxml([...entrada, cel(5, 13, "X", "1+98")], false, "fonte", "cliente", [], {});
  expect(resultado).toEqual({ estado: "pendente", pendencias: [{ referencia: "R5C13", motivo: "formula" }] });
});

it("permite conferir fórmulas em colunas auxiliares sem usar seus valores", () => {
  const resultado = previaCronogramaOoxml([...dados(), cel(5, 14, "99", "1+98")], false, "fonte", "cliente", [], {});
  expect(resultado.estado).toBe("conferivel");
  if (resultado.estado !== "conferivel") throw new Error("prévia bloqueada");
  expect(resultado.avisos).toEqual([{ referencia: "R5C14", motivo: "formula" }]);
  expect(resultado.linhas[0]?.original.valoresOriginais[13]).toBeNull();
});
