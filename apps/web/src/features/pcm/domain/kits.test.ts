import { describe, expect, it } from "vitest";
import {
  type KitAtribuicaoAtiva,
  itensFaltantes,
  kitAtribuicaoEstaCompleta,
  kitEstaCompleto,
  validarAtribuirKit,
  validarKit,
} from "./kits";

describe("kits", () => {
  it("normaliza cadastro de kit", () => {
    expect(
      validarKit({
        nome: "  Kit Elétrica ",
        itens: [{ ferramentaId: "f1", quantidade: 2 }],
      }),
    ).toEqual({
      nome: "Kit Elétrica",
      descricao: null,
      itens: [{ ferramentaId: "f1", quantidade: 2 }],
    });
  });

  it("bloqueia kit sem itens", () => {
    expect(() => validarKit({ nome: "Kit", itens: [] })).toThrow("pelo menos 1 item");
  });

  it("bloqueia ferramenta duplicada no kit", () => {
    expect(() =>
      validarKit({
        nome: "Kit",
        itens: [
          { ferramentaId: "f1", quantidade: 1 },
          { ferramentaId: "f1", quantidade: 2 },
        ],
      }),
    ).toThrow("só pode aparecer 1 vez");
  });

  it("bloqueia quantidade zero ou negativa", () => {
    expect(() =>
      validarKit({ nome: "Kit", itens: [{ ferramentaId: "f1", quantidade: 0 }] }),
    ).toThrow("maior que zero");
  });

  it("valida atribuição exige kit e técnico", () => {
    expect(validarAtribuirKit({ kitId: "k1", funcionarioId: "f1" })).toEqual({
      kitId: "k1",
      funcionarioId: "f1",
    });
    expect(() => validarAtribuirKit({ kitId: "", funcionarioId: "f1" })).toThrow("Kit");
    expect(() => validarAtribuirKit({ kitId: "k1", funcionarioId: "" })).toThrow("Técnico");
  });

  it("kit completo quando há unidade disponível suficiente de cada item", () => {
    const itens = [
      { ferramentaId: "f1", ferramentaNome: "Furadeira", quantidade: 2 },
      { ferramentaId: "f2", ferramentaNome: "Chave", quantidade: 1 },
    ];
    expect(
      kitEstaCompleto(
        itens,
        new Map([
          ["f1", 2],
          ["f2", 3],
        ]),
      ),
    ).toBe(true);
  });

  it("kit incompleto quando falta unidade de 1 item", () => {
    const itens = [
      { ferramentaId: "f1", ferramentaNome: "Furadeira", quantidade: 2 },
      { ferramentaId: "f2", ferramentaNome: "Chave", quantidade: 1 },
    ];
    expect(
      kitEstaCompleto(
        itens,
        new Map([
          ["f1", 1],
          ["f2", 3],
        ]),
      ),
    ).toBe(false);
    expect(
      itensFaltantes(
        itens,
        new Map([
          ["f1", 1],
          ["f2", 3],
        ]),
      ),
    ).toEqual([{ ferramentaId: "f1", ferramentaNome: "Furadeira", quantidade: 2 }]);
  });

  it("kit atribuído completo quando todas as unidades ainda estão com o técnico", () => {
    const atribuicao: KitAtribuicaoAtiva = {
      kitAtribuicaoId: "k1",
      funcionarioId: "f1",
      funcionarioNome: "Técnico",
      totalItens: 3,
      itensAindaComTecnico: 3,
      unidades: [],
    };
    expect(kitAtribuicaoEstaCompleta(atribuicao)).toBe(true);
  });

  it("kit atribuído incompleto quando 1 unidade saiu do grupo isolada", () => {
    const atribuicao: KitAtribuicaoAtiva = {
      kitAtribuicaoId: "k1",
      funcionarioId: "f1",
      funcionarioNome: "Técnico",
      totalItens: 3,
      itensAindaComTecnico: 2,
      unidades: [],
    };
    expect(kitAtribuicaoEstaCompleta(atribuicao)).toBe(false);
  });
});
