import { describe, expect, it } from "vitest";
import { conferirCodigoEmLeitura } from "./codigos-publicos";

describe("conferência de código público", () => {
  const sistema = { tipo: "sistema" as const, ativoId: "s1", clienteId: "c1" };
  it("resolve código antigo e atual para mesma identidade quando a leitura é completa", () => {
    const registros = [
      { ...sistema, codigo: "ANTIGO-1", natureza: "alias" as const },
      { ...sistema, codigo: "NOVO-1", natureza: "atual" as const },
    ];
    expect(conferirCodigoEmLeitura("ANTIGO-1", registros, true)).toEqual({
      situacao: "encontrado",
      alvo: sistema,
    });
    expect(conferirCodigoEmLeitura("NOVO-1", registros, true)).toEqual({
      situacao: "encontrado",
      alvo: sistema,
    });
  });
  it("não escolhe vencedor quando códigos exatos pertencem a ativos diferentes", () => {
    expect(
      conferirCodigoEmLeitura(
        "ANTIGO-1",
        [
          { ...sistema, codigo: "ANTIGO-1", natureza: "alias" },
          {
            tipo: "componente",
            ativoId: "e1",
            clienteId: "c2",
            codigo: "ANTIGO-1",
            natureza: "atual",
          },
        ],
        true,
      ),
    ).toEqual({ situacao: "ambiguo" });
  });
  it("não conclui presença ou ausência com leitura incompleta", () => {
    expect(
      conferirCodigoEmLeitura("A", [{ ...sistema, codigo: "A", natureza: "atual" }], false),
    ).toEqual({ situacao: "incompleto" });
    expect(conferirCodigoEmLeitura("A", [], false)).toEqual({ situacao: "incompleto" });
  });
  it("preserva comparação literal dos códigos legados sem normalização", () => {
    expect(
      conferirCodigoEmLeitura("abc", [{ ...sistema, codigo: "ABC", natureza: "atual" }], true),
    ).toEqual({ situacao: "nao_encontrado" });
  });
  it("não informa identidade com Cliente ausente", () => {
    expect(
      conferirCodigoEmLeitura(
        "ANTIGO-1",
        [{ ...sistema, clienteId: "", codigo: "ANTIGO-1", natureza: "alias" }],
        true,
      ),
    ).toEqual({ situacao: "incompleto" });
  });
  it("recusa pesquisa sem código", () => {
    expect(() => conferirCodigoEmLeitura(" ", [], true)).toThrow(/inválido/i);
  });
});
