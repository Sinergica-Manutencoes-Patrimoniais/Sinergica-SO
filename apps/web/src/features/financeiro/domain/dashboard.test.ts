import { describe, expect, it } from "vitest";
import { agregarGastosPorRaiz, formatarMesCurto } from "./dashboard";

describe("formatarMesCurto", () => {
  it("formata data ISO em mês curto pt-BR", () => {
    expect(formatarMesCurto("2026-07-01")).toMatch(/jul/i);
  });
});

describe("agregarGastosPorRaiz", () => {
  const categorias = [
    { id: "raiz-1", nome: "Operação", parentId: null },
    { id: "sub-1", nome: "Combustível", parentId: "raiz-1" },
    { id: "raiz-2", nome: "Pessoal", parentId: null },
  ];

  it("soma subcategoria dentro da raiz", () => {
    const resultado = agregarGastosPorRaiz(
      [
        { categoriaId: "raiz-1", totalCentavos: 1000 },
        { categoriaId: "sub-1", totalCentavos: 500 },
        { categoriaId: "raiz-2", totalCentavos: 500 },
      ],
      categorias,
    );
    const operacao = resultado.find((r) => r.categoriaId === "raiz-1");
    expect(operacao?.totalCentavos).toBe(1500);
  });

  it("calcula percentual do total", () => {
    const resultado = agregarGastosPorRaiz(
      [
        { categoriaId: "raiz-1", totalCentavos: 750 },
        { categoriaId: "raiz-2", totalCentavos: 250 },
      ],
      categorias,
    );
    expect(resultado[0]?.percentual).toBeCloseTo(75);
    expect(resultado[1]?.percentual).toBeCloseTo(25);
  });

  it("ordena desc por total", () => {
    const resultado = agregarGastosPorRaiz(
      [
        { categoriaId: "raiz-2", totalCentavos: 100 },
        { categoriaId: "raiz-1", totalCentavos: 900 },
      ],
      categorias,
    );
    expect(resultado.map((r) => r.categoriaId)).toEqual(["raiz-1", "raiz-2"]);
  });

  it("lista vazia sem erro", () => {
    expect(agregarGastosPorRaiz([], categorias)).toEqual([]);
  });

  it("categoria orfã (não encontrada) usa fallback", () => {
    const resultado = agregarGastosPorRaiz(
      [{ categoriaId: "fantasma", totalCentavos: 100 }],
      categorias,
    );
    expect(resultado[0]?.nome).toBe("Sem categoria");
  });
});
