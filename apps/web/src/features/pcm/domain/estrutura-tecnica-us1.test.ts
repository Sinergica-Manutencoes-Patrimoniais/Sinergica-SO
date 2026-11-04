import { describe, expect, it } from "vitest";
import { validarGrupoQuantitativo } from "./estrutura-tecnica";

const grupo = {
  clienteId: "cliente-a",
  localId: "sala-a",
  categoriaId: "luminaria",
  nome: "Luminárias",
  quantidade: 20,
  caracteristicas: { potencia: "12 W" },
};

describe("Grupo Quantitativo", () => {
  it("mantém um grupo por Local com quantidade e características", () => {
    const resultado = validarGrupoQuantitativo(grupo);
    expect(resultado).toEqual(grupo);
    expect(resultado).not.toHaveProperty("itensGerados");
  });
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejeita quantidade inválida %s",
    (quantidade) => {
      expect(() => validarGrupoQuantitativo({ ...grupo, quantidade })).toThrow();
    },
  );
  it("exige Cliente, Local, categoria e nome", () => {
    for (const campo of ["clienteId", "localId", "categoriaId", "nome"] as const) {
      expect(() => validarGrupoQuantitativo({ ...grupo, [campo]: "  " })).toThrow();
    }
  });
  it("normaliza o nome sem modificar as características recebidas", () => {
    expect(validarGrupoQuantitativo({ ...grupo, nome: "  Luminárias  " }).nome).toBe("Luminárias");
    expect(grupo.caracteristicas).toEqual({ potencia: "12 W" });
  });
});
