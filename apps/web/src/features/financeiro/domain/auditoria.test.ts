import { describe, expect, it } from "vitest";
import { diferencasLancamento } from "./auditoria";

const base = { valorCentavos: 1000, categoriaId: "cat-1", dataCompetencia: "2026-07-01" };

describe("diferencasLancamento", () => {
  it("sem mudanca retorna lista vazia", () => {
    expect(diferencasLancamento(base, { ...base })).toEqual([]);
  });

  it("detecta mudanca de valor", () => {
    const diffs = diferencasLancamento(base, { ...base, valorCentavos: 2000 });
    expect(diffs).toEqual([{ campo: "valor_centavos", valorAnterior: "1000", valorNovo: "2000" }]);
  });

  it("detecta mudanca de categoria e data juntas", () => {
    const diffs = diferencasLancamento(base, {
      ...base,
      categoriaId: "cat-2",
      dataCompetencia: "2026-08-01",
    });
    expect(diffs).toHaveLength(2);
    expect(diffs.map((d) => d.campo)).toEqual(["categoria_id", "data_competencia"]);
  });
});
