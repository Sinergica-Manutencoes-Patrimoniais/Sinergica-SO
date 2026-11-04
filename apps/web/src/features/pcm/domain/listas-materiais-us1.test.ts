import { describe, expect, it } from "vitest";
import { organizarTextoMateriais } from "./listas-materiais";

describe("organização determinística de materiais", () => {
  it("extrai quantidades explícitas em bullets sem inventar unidades", () => {
    const original =
      "- 2 tubos\n• 1,5 m cabo\n* 3 x disjuntores\n\nVerificar materiais com o técnico.";
    const resultado = organizarTextoMateriais(original);
    expect(resultado.textoOriginal).toBe(original);
    expect(resultado.linhas).toEqual([
      { trechoOriginal: "- 2 tubos", descricao: "tubos", quantidade: "2", unidade: null },
      { trechoOriginal: "• 1,5 m cabo", descricao: "cabo", quantidade: "1,5", unidade: "m" },
      {
        trechoOriginal: "* 3 x disjuntores",
        descricao: "disjuntores",
        quantidade: "3",
        unidade: null,
      },
      {
        trechoOriginal: "Verificar materiais com o técnico.",
        descricao: "Verificar materiais com o técnico.",
        quantidade: null,
        unidade: null,
      },
    ]);
  });

  it("mantém prosa, números ambíguos e ausência de descrição intactos", () => {
    const original =
      "Precisamos de 2 tubos, confirme antes.\n2 000 tubos\n- 3 kg\n2 pessoas devem verificar\n- 2 x\n";
    const resultado = organizarTextoMateriais(original);
    expect(resultado.textoOriginal).toBe(original);
    expect(resultado.linhas).toEqual([
      {
        trechoOriginal: "Precisamos de 2 tubos, confirme antes.",
        descricao: "Precisamos de 2 tubos, confirme antes.",
        quantidade: null,
        unidade: null,
      },
      { trechoOriginal: "2 000 tubos", descricao: "2 000 tubos", quantidade: null, unidade: null },
      { trechoOriginal: "- 3 kg", descricao: "- 3 kg", quantidade: null, unidade: null },
      {
        trechoOriginal: "2 pessoas devem verificar",
        descricao: "2 pessoas devem verificar",
        quantidade: null,
        unidade: null,
      },
      { trechoOriginal: "- 2 x", descricao: "- 2 x", quantidade: null, unidade: null },
    ]);
  });

  it("respeita texto original, quebras CRLF e quantidade decimal literal", () => {
    const textoOriginal = "  2,50 un válvula  \r\n\r\n- conferir 10 peças";
    expect(organizarTextoMateriais(textoOriginal)).toEqual({
      textoOriginal,
      linhas: [
        {
          trechoOriginal: "  2,50 un válvula  ",
          descricao: "válvula",
          quantidade: "2,50",
          unidade: "un",
        },
        {
          trechoOriginal: "- conferir 10 peças",
          descricao: "- conferir 10 peças",
          quantidade: null,
          unidade: null,
        },
      ],
    });
  });

  it("permite texto sem linhas e não cria itens ou unidades por padrão", () => {
    expect(organizarTextoMateriais(" \n\n")).toEqual({ textoOriginal: " \n\n", linhas: [] });
  });

  it("distingue marcador numérico de quantidade e preserva trecho ambíguo", () => {
    const textoOriginal = "1. 3 parafusos\n2) 1,5 m cabo\n3. verificar peças\n3.5 m mangueira";
    expect(organizarTextoMateriais(textoOriginal)).toEqual({
      textoOriginal,
      linhas: [
        { trechoOriginal: "1. 3 parafusos", descricao: "parafusos", quantidade: "3", unidade: null },
        { trechoOriginal: "2) 1,5 m cabo", descricao: "cabo", quantidade: "1,5", unidade: "m" },
        { trechoOriginal: "3. verificar peças", descricao: "3. verificar peças", quantidade: null, unidade: null },
        { trechoOriginal: "3.5 m mangueira", descricao: "mangueira", quantidade: "3.5", unidade: "m" },
      ],
    });
  });

});
