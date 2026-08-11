import { describe, expect, it } from "vitest";
import {
  formatarObservacaoBacklog,
  montarTextoParaClassificacao,
  parearClassificacaoComItens,
} from "./inspecao-revisao-lote";

describe("montarTextoParaClassificacao", () => {
  it("monta um bloco Local/Relato por item, separados por ---", () => {
    const texto = montarTextoParaClassificacao([
      { id: "1", localizacao: "Hall 15 BL A", descricao: "Cabos expostos" },
      { id: "2", localizacao: null, descricao: "Vazamento na bomba" },
    ]);
    expect(texto).toBe(
      "Local: Hall 15 BL A\nRelato: Cabos expostos\n\n---\n\nLocal: \nRelato: Vazamento na bomba",
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
        gravidade: 5,
        urgencia: 4,
        tendencia: 5,
        esforcoHoras: 4,
        justificativaEsforco: "Risco elétrico",
        citacaoNormativa: "NBR 17240:2010",
      },
      {
        gravidade: 3,
        urgencia: 3,
        tendencia: 2,
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
        esforcoHoras: 4,
        justificativaEsforco: "Risco elétrico",
        citacaoNormativa: "NBR 17240:2010",
      },
      {
        itemId: "2",
        gravidade: 3,
        urgencia: 3,
        tendencia: 2,
        esforcoHoras: 1.5,
        justificativaEsforco: null,
        citacaoNormativa: "NBR 5626:2020",
      },
    ]);
  });

  it("cai pro fallback 3/3/3 quando a contagem não bate, sem bloquear", () => {
    const resultado = parearClassificacaoComItens(itens, [
      {
        gravidade: 5,
        urgencia: 5,
        tendencia: 5,
        esforcoHoras: 2,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
    ]);
    expect(resultado.correlacionou).toBe(false);
    expect(resultado.itens).toEqual([
      {
        itemId: "1",
        gravidade: 3,
        urgencia: 3,
        tendencia: 3,
        esforcoHoras: 0,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
      {
        itemId: "2",
        gravidade: 3,
        urgencia: 3,
        tendencia: 3,
        esforcoHoras: 0,
        justificativaEsforco: null,
        citacaoNormativa: null,
      },
    ]);
  });
});

describe("formatarObservacaoBacklog", () => {
  it("junta esforço, justificativa e citação normativa em texto legível", () => {
    const texto = formatarObservacaoBacklog({
      gravidade: 5,
      urgencia: 5,
      tendencia: 5,
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
      esforcoHoras: 0,
      justificativaEsforco: null,
      citacaoNormativa: null,
    });
    expect(texto).toBe("Esforço estimado: 0h");
  });
});
