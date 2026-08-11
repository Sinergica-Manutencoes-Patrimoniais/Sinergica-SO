import { describe, expect, it } from "vitest";
import {
  type ItemAssessmentParaImportar,
  formatarDescricaoItemImportado,
  importarItensDoAssessment,
  itemAssessmentEhImportavel,
} from "./importacao-levantamento";

function item(overrides: Partial<ItemAssessmentParaImportar> = {}): ItemAssessmentParaImportar {
  return {
    sistema: "eletrico",
    localizacao: null,
    descricao: "Quadro sem identificação",
    resultado: "nao_conforme",
    recomendacao: null,
    ...overrides,
  };
}

describe("itemAssessmentEhImportavel", () => {
  it("importa não conforme e atenção", () => {
    expect(itemAssessmentEhImportavel("nao_conforme")).toBe(true);
    expect(itemAssessmentEhImportavel("atencao")).toBe(true);
  });

  it("não importa conforme, não avaliado e não aplicável", () => {
    expect(itemAssessmentEhImportavel("conforme")).toBe(false);
    expect(itemAssessmentEhImportavel("nao_avaliado")).toBe(false);
    expect(itemAssessmentEhImportavel("nao_aplicavel")).toBe(false);
  });
});

describe("formatarDescricaoItemImportado", () => {
  it("só a descrição quando não há localização nem recomendação", () => {
    expect(formatarDescricaoItemImportado(item())).toBe("Quadro sem identificação");
  });

  it("acrescenta localização entre parênteses", () => {
    expect(formatarDescricaoItemImportado(item({ localizacao: "Casa de máquinas" }))).toBe(
      "Quadro sem identificação (Casa de máquinas)",
    );
  });

  it("acrescenta recomendação depois de travessão", () => {
    expect(
      formatarDescricaoItemImportado(item({ recomendacao: "Instalar identificação normativa" })),
    ).toBe("Quadro sem identificação — Instalar identificação normativa");
  });

  it("combina localização e recomendação", () => {
    expect(
      formatarDescricaoItemImportado(
        item({ localizacao: "Casa de máquinas", recomendacao: "Instalar identificação normativa" }),
      ),
    ).toBe("Quadro sem identificação (Casa de máquinas) — Instalar identificação normativa");
  });
});

describe("importarItensDoAssessment", () => {
  it("levantamento vazio: lista vazia, sem erro", () => {
    const resultado = importarItensDoAssessment([]);
    expect(resultado.itensImportados).toEqual([]);
    expect(resultado.quantidadeImportada).toBe(0);
    expect(resultado.quantidadeIgnorada).toBe(0);
  });

  it("filtra conforme/não avaliado/não aplicável, mantém não conforme/atenção", () => {
    const resultado = importarItensDoAssessment([
      item({ resultado: "nao_conforme", descricao: "Item 1" }),
      item({ resultado: "conforme", descricao: "Item 2" }),
      item({ resultado: "atencao", descricao: "Item 3" }),
      item({ resultado: "nao_avaliado", descricao: "Item 4" }),
      item({ resultado: "nao_aplicavel", descricao: "Item 5" }),
    ]);
    expect(resultado.quantidadeImportada).toBe(2);
    expect(resultado.quantidadeIgnorada).toBe(3);
    expect(resultado.itensImportados.map((i) => i.descricao)).toEqual(["Item 1", "Item 3"]);
  });

  it("todo item importado nasce com quantidade 1 e custo zero — comercial precifica depois", () => {
    const resultado = importarItensDoAssessment([item()]);
    expect(resultado.itensImportados[0]).toMatchObject({ quantidade: 1, custoUnitarioCentavos: 0 });
  });

  it("levantamento só com itens conformes: nada importa, mas não é erro", () => {
    const resultado = importarItensDoAssessment([
      item({ resultado: "conforme" }),
      item({ resultado: "nao_aplicavel" }),
    ]);
    expect(resultado.itensImportados).toEqual([]);
    expect(resultado.quantidadeIgnorada).toBe(2);
  });

  it("itens duplicados entram os dois — quem decide o que apagar é o usuário (spec, edge case)", () => {
    const resultado = importarItensDoAssessment([item(), item()]);
    expect(resultado.quantidadeImportada).toBe(2);
  });
});
