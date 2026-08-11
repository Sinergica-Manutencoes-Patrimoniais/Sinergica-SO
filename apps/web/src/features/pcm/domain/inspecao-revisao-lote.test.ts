import { describe, expect, it } from "vitest";
import {
  formatarObservacaoBacklog,
  montarTextoParaClassificacao,
  parearClassificacaoComItens,
} from "./inspecao-revisao-lote";

describe("montarTextoParaClassificacao", () => {
  // O número é o que amarra a resposta da IA de volta ao item — sem ele o pareamento dependia da
  // contagem, que era exatamente a origem do bug do fallback 3/3/3.
  it("numera os itens e monta um bloco Local/Relato por item, separados por ---", () => {
    const texto = montarTextoParaClassificacao([
      { id: "1", localizacao: "Hall 15 BL A", descricao: "Cabos expostos" },
      { id: "2", localizacao: null, descricao: "Vazamento na bomba" },
    ]);
    expect(texto).toBe(
      "1. Local: Hall 15 BL A\nRelato: Cabos expostos\n\n---\n\n2. Local: \nRelato: Vazamento na bomba",
    );
  });
});

describe("parearClassificacaoComItens", () => {
  const itens = [
    { id: "1", localizacao: "Hall", descricao: "Cabos expostos" },
    { id: "2", localizacao: "Piscina", descricao: "Vazamento" },
  ];

  it("pareia por índice quando a contagem bate", () => {
    const resultado = parearClassificacaoComItens(itens, [
      {
        indice: 1,
        gravidade: 5,
        urgencia: 4,
        tendencia: 5,
        dorCliente: 3,
        esforcoHoras: 4,
        justificativaEsforco: "Risco elétrico",
        citacaoNormativa: "NBR 17240:2010",
      },
      {
        indice: 2,
        gravidade: 3,
        urgencia: 3,
        tendencia: 2,
        dorCliente: 3,
        esforcoHoras: 1.5,
        justificativaEsforco: null,
        citacaoNormativa: "NBR 5626:2020",
      },
    ]);
    expect(resultado.correlacionou).toBe(true);
    expect(resultado.itens).toEqual([
      {
        itemId: "1",
        gravidade: 5,
        urgencia: 4,
        tendencia: 5,
        dorCliente: 3,
        esforcoHoras: 4,
        justificativaEsforco: "Risco elétrico",
        citacaoNormativa: "NBR 17240:2010",
      },
      {
        itemId: "2",
        gravidade: 3,
        urgencia: 3,
        tendencia: 2,
        dorCliente: 3,
        esforcoHoras: 1.5,
        justificativaEsforco: null,
        citacaoNormativa: "NBR 5626:2020",
      },
    ]);
  });

  // Mudança de comportamento (2026-08-11): antes, faltando UMA classificação, os DOIS itens
  // caíam no fallback e o trabalho da IA era descartado inteiro. Agora só o item sem nota usa o
  // fallback — `correlacionou: false` sinaliza a lacuna sem jogar fora o que veio certo.
  it("usa fallback só no item que a IA não classificou, preservando os demais", () => {
    const resultado = parearClassificacaoComItens(itens, [
      {
        indice: 1,
        gravidade: 5,
        urgencia: 5,
        tendencia: 5,
        dorCliente: 3,
        esforcoHoras: 2,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
    ]);
    expect(resultado.correlacionou).toBe(false);
    expect(resultado.itens).toEqual([
      {
        itemId: "1",
        gravidade: 5,
        urgencia: 5,
        tendencia: 5,
        dorCliente: 3,
        esforcoHoras: 2,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
      {
        itemId: "2",
        gravidade: 3,
        urgencia: 3,
        tendencia: 3,
        dorCliente: 3,
        esforcoHoras: 0,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
    ]);
  });

  it("descarta índice fora da faixa em vez de casar com o item errado", () => {
    const resultado = parearClassificacaoComItens(itens, [
      {
        indice: 99,
        gravidade: 5,
        urgencia: 5,
        tendencia: 5,
        dorCliente: 5,
        esforcoHoras: 2,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
    ]);
    expect(resultado.correlacionou).toBe(false);
    expect(resultado.itens.every((i) => i.gravidade === 3)).toBe(true);
  });

  it("pareia pelo índice mesmo com a IA devolvendo fora de ordem", () => {
    const resultado = parearClassificacaoComItens(itens, [
      {
        indice: 2,
        gravidade: 1,
        urgencia: 1,
        tendencia: 1,
        dorCliente: 1,
        esforcoHoras: 0,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
      {
        indice: 1,
        gravidade: 5,
        urgencia: 5,
        tendencia: 5,
        dorCliente: 5,
        esforcoHoras: 0,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
    ]);
    expect(resultado.correlacionou).toBe(true);
    expect(resultado.itens[0]).toMatchObject({ itemId: "1", gravidade: 5 });
    expect(resultado.itens[1]).toMatchObject({ itemId: "2", gravidade: 1 });
  });
});

describe("formatarObservacaoBacklog", () => {
  it("junta esforço, justificativa e citação normativa em texto legível", () => {
    const texto = formatarObservacaoBacklog({
      gravidade: 5,
      urgencia: 5,
      tendencia: 5,
      dorCliente: 3,
      esforcoHoras: 4,
      justificativaEsforco: "Precisa de eletricista + material",
      citacaoNormativa: "NBR 17240:2010 item 5.4.3",
    });
    expect(texto).toBe(
      "Esforço estimado: 4h\nJustificativa: Precisa de eletricista + material\nEmbasamento normativo: NBR 17240:2010 item 5.4.3",
    );
  });

  it("omite linhas nulas", () => {
    const texto = formatarObservacaoBacklog({
      gravidade: 3,
      urgencia: 3,
      tendencia: 3,
      dorCliente: 3,
      esforcoHoras: 0,
      justificativaEsforco: null,
      citacaoNormativa: null,
    });
    expect(texto).toBe("Esforço estimado: 0h");
  });
});
