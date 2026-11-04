import { describe, expect, it } from "vitest";
import {
  montarComandoSalvarComposicao,
  montarItensImportadosDoLevantamento,
  podeVincularLevantamentoAtual,
} from "./proposta";

it("só oferece vínculo quando seleção consta na consulta atual sem falha ou reconsulta", () => {
  const opcoes = [{ id: "a" }];
  expect(podeVincularLevantamentoAtual("a", opcoes, false, false)).toBe(true);
  expect(podeVincularLevantamentoAtual("a", opcoes, true, false)).toBe(false);
  expect(podeVincularLevantamentoAtual("a", opcoes, false, true)).toBe(false);
  expect(podeVincularLevantamentoAtual("b", opcoes, false, false)).toBe(false);
});

describe("montarComandoSalvarComposicao", () => {
  it("soma os itens, calcula preço/piso pela fórmula e usa o preço sugerido por padrão", () => {
    const comando = montarComandoSalvarComposicao({
      propostaId: "p1",
      itens: [
        { tipo: "mo", descricao: "8h técnico", quantidade: 8, custoUnitarioCentavos: 2_000 },
        { tipo: "material", descricao: "Compressor", quantidade: 1, custoUnitarioCentavos: 5_000 },
      ],
      margem: 0.2,
      aliquota: 0.06,
    });

    // custo = 8*2000 + 1*5000 = 21.000
    expect(comando.custoTotalCentavos).toBe(21_000);
    expect(comando.pisoCentavos).toBe(Math.round(21_000 / 0.94));
    expect(comando.precoSugeridoCentavos).toBe(Math.round((21_000 * 1.2) / 0.94));
    // Sem preço final informado: cobra exatamente o sugerido (sem desconto).
    expect(comando.precoCentavos).toBe(comando.precoSugeridoCentavos);
  });

  it("usa o preço final informado quando o usuário aplica desconto manual", () => {
    const comando = montarComandoSalvarComposicao({
      propostaId: "p1",
      itens: [{ tipo: "mo", descricao: "10h", quantidade: 10, custoUnitarioCentavos: 2_000 }],
      margem: 0.2,
      aliquota: 0.06,
      precoFinalCentavos: 22_000,
    });
    expect(comando.precoCentavos).toBe(22_000);
    expect(comando.precoCentavos).not.toBe(comando.precoSugeridoCentavos);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "recusa preço final inválido %s antes de chamar o servidor",
    (precoFinalCentavos) => {
      expect(() =>
        montarComandoSalvarComposicao({
          propostaId: "p1",
          itens: [],
          margem: 0,
          aliquota: 0,
          precoFinalCentavos,
        }),
      ).toThrow();
    },
  );

  it("lista vazia de itens dá custo zero, sem lançar", () => {
    const comando = montarComandoSalvarComposicao({
      propostaId: "p1",
      itens: [],
      margem: 0.2,
      aliquota: 0.06,
    });
    expect(comando.custoTotalCentavos).toBe(0);
    expect(comando.pisoCentavos).toBe(0);
  });

  it("repassa escopo/observacoes/validoAte sem alterar", () => {
    const comando = montarComandoSalvarComposicao({
      propostaId: "p1",
      itens: [],
      margem: 0.1,
      aliquota: 0,
      escopo: "Manutenção preventiva mensal",
      observacoes: "Cliente pediu revisão trimestral",
      validoAte: "2026-09-01",
    });
    expect(comando.escopo).toBe("Manutenção preventiva mensal");
    expect(comando.observacoes).toBe("Cliente pediu revisão trimestral");
    expect(comando.validoAte).toBe("2026-09-01");
  });
});

describe("montarItensImportadosDoLevantamento", () => {
  it("converte item importável do Assessment em ItemCommand tipo 'outro', sem nível/material", () => {
    const resultado = montarItensImportadosDoLevantamento([
      {
        sistema: "eletrico",
        localizacao: "Casa de máquinas",
        descricao: "Quadro sem identificação",
        resultado: "nao_conforme",
        recomendacao: "Instalar identificação normativa",
      },
    ]);
    expect(resultado.quantidadeImportada).toBe(1);
    expect(resultado.quantidadeIgnorada).toBe(0);
    expect(resultado.itens).toEqual([
      {
        tipo: "outro",
        descricao: "Quadro sem identificação (Casa de máquinas) — Instalar identificação normativa",
        nivelId: null,
        materialId: null,
        quantidade: 1,
        custoUnitarioCentavos: 0,
      },
    ]);
  });

  it("levantamento vazio: nenhum item, sem lançar", () => {
    const resultado = montarItensImportadosDoLevantamento([]);
    expect(resultado.itens).toEqual([]);
    expect(resultado.quantidadeImportada).toBe(0);
  });

  it("filtra itens conformes — não viram ItemCommand", () => {
    const resultado = montarItensImportadosDoLevantamento([
      {
        sistema: "hidrossanitario",
        localizacao: null,
        descricao: "Tubulação ok",
        resultado: "conforme",
        recomendacao: null,
      },
    ]);
    expect(resultado.itens).toEqual([]);
    expect(resultado.quantidadeIgnorada).toBe(1);
  });
});
