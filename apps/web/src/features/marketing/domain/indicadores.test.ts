import { describe, expect, it } from "vitest";
import {
  type LinhaDeAnuncio,
  arvoreDoRelatorio,
  custo,
  dividir,
  indicadores,
  ordenarPor,
  semVeiculacao,
  somar,
} from "./indicadores";

function linha(parcial: Partial<LinhaDeAnuncio> & { anuncioId: string }): LinhaDeAnuncio {
  return {
    campanhaId: "camp-1",
    campanhaNome: "Campanha A",
    campanhaSituacao: "ACTIVE",
    conjuntoId: "conj-1",
    conjuntoNome: "Conjunto A",
    anuncioNome: `Anúncio ${parcial.anuncioId}`,
    anuncioSituacao: "ACTIVE",
    temNumeros: true,
    gastoCentavos: 0,
    alcance: 0,
    impressoes: 0,
    cliques: 0,
    leads: 0,
    ...parcial,
  };
}

describe("indicadores — derivados (E06-S01)", () => {
  it("AC-5: custo por lead com zero leads é indisponível, não zero", () => {
    const i = indicadores({
      temNumeros: true,
      gastoCentavos: 50_000,
      alcance: 100,
      impressoes: 1000,
      cliques: 20,
      leads: 0,
    });
    expect(i.custoPorLeadCentavos).toBeNull();
    expect(i.custoPorLeadCentavos).not.toBe(0);
  });

  it("AC-5: custo por lead sem gasto também é indisponível — lead de graça não é lead a R$ 0", () => {
    expect(custo(0, 5)).toBeNull();
    expect(custo(500, 5)).toBe(100);
  });

  it("taxa com numerador zero é 0; com denominador zero é indisponível", () => {
    expect(dividir(0, 1000)).toBe(0);
    expect(dividir(10, 0)).toBeNull();
  });

  it("CPM é por mil impressões", () => {
    const i = indicadores({
      temNumeros: true,
      gastoCentavos: 10_000,
      alcance: 0,
      impressoes: 2000,
      cliques: 0,
      leads: 0,
    });
    expect(i.cpmCentavos).toBe(5000);
    expect(i.ctr).toBe(0);
    expect(i.cpcCentavos).toBeNull();
  });

  it("temNumeros é um OU na soma: um anúncio com número basta", () => {
    const total = somar([
      { temNumeros: false, gastoCentavos: 0, alcance: 0, impressoes: 0, cliques: 0, leads: 0 },
      { temNumeros: true, gastoCentavos: 100, alcance: 1, impressoes: 2, cliques: 3, leads: 4 },
    ]);
    expect(total.temNumeros).toBe(true);
    expect(total.gastoCentavos).toBe(100);
  });
});

describe("indicadores — árvore (E06-S01)", () => {
  const linhas: LinhaDeAnuncio[] = [
    linha({
      anuncioId: "a1",
      gastoCentavos: 30_000,
      impressoes: 6000,
      cliques: 150,
      leads: 6,
      alcance: 2000,
    }),
    linha({
      anuncioId: "a2",
      conjuntoId: "conj-2",
      conjuntoNome: "Conjunto B",
      gastoCentavos: 20_000,
      impressoes: 4000,
      cliques: 50,
      leads: 2,
      alcance: 1500,
    }),
    linha({
      anuncioId: "a3",
      campanhaId: "camp-2",
      campanhaNome: "Campanha B",
      conjuntoId: "conj-3",
      conjuntoNome: "Conjunto C",
      gastoCentavos: 10_000,
      impressoes: 1000,
      cliques: 10,
      leads: 0,
      alcance: 800,
    }),
  ];

  it("AC-2: a soma dos conjuntos é igual à da campanha em gasto, impressões, cliques e leads", () => {
    const { campanhas } = arvoreDoRelatorio(linhas);
    const campanhaA = campanhas.find((c) => c.id === "camp-1");
    if (!campanhaA) throw new Error("campanha A sumiu da árvore");
    const soma = campanhaA.conjuntos.reduce(
      (acc, c) => ({
        gasto: acc.gasto + c.indicadores.gastoCentavos,
        impressoes: acc.impressoes + c.indicadores.impressoes,
        cliques: acc.cliques + c.indicadores.cliques,
        leads: acc.leads + c.indicadores.leads,
      }),
      { gasto: 0, impressoes: 0, cliques: 0, leads: 0 },
    );
    expect(soma.gasto).toBe(campanhaA.indicadores.gastoCentavos);
    expect(soma.impressoes).toBe(campanhaA.indicadores.impressoes);
    expect(soma.cliques).toBe(campanhaA.indicadores.cliques);
    expect(soma.leads).toBe(campanhaA.indicadores.leads);
  });

  it("AC-1: o total do período é a soma das campanhas", () => {
    const { total } = arvoreDoRelatorio(linhas);
    expect(total.gastoCentavos).toBe(60_000);
    expect(total.leads).toBe(8);
    expect(total.custoPorLeadCentavos).toBe(7500);
  });

  it("AC-3: o conjunto carrega seus anúncios, e o anúncio tem os mesmos indicadores", () => {
    const { campanhas } = arvoreDoRelatorio(linhas);
    const conjuntoA = campanhas[0]?.conjuntos[0];
    if (!conjuntoA) throw new Error("conjunto A sumiu da árvore");
    expect(conjuntoA.anuncios).toHaveLength(1);
    expect(conjuntoA.anuncios[0]?.indicadores.custoPorLeadCentavos).toBe(5000);
  });

  it("AC-5: campanha que gastou e não gerou lead tem custo por lead indisponível", () => {
    const { campanhas } = arvoreDoRelatorio(linhas);
    const campanhaB = campanhas.find((c) => c.id === "camp-2");
    expect(campanhaB?.indicadores.gastoCentavos).toBe(10_000);
    expect(campanhaB?.indicadores.custoPorLeadCentavos).toBeNull();
  });

  it("AC-4: sem linha nenhuma, o relatório se declara sem veiculação", () => {
    expect(semVeiculacao(arvoreDoRelatorio([]))).toBe(true);
    expect(semVeiculacao(arvoreDoRelatorio(linhas))).toBe(false);
  });
});

describe("indicadores — ordenação (E06-S01)", () => {
  const { campanhas } = arvoreDoRelatorio([
    linha({ anuncioId: "a1", gastoCentavos: 30_000, impressoes: 6000, leads: 6 }),
    linha({
      anuncioId: "a3",
      campanhaId: "camp-2",
      campanhaNome: "Campanha B",
      conjuntoId: "conj-3",
      gastoCentavos: 10_000,
      impressoes: 1000,
      leads: 0,
    }),
  ]);

  it("ordena por gasto, do maior para o menor", () => {
    expect(ordenarPor(campanhas, "gastoCentavos").map((c) => c.nome)).toEqual([
      "Campanha A",
      "Campanha B",
    ]);
  });

  it("o indisponível vai para o fim nos dois sentidos — não é nem o melhor nem o pior", () => {
    expect(ordenarPor(campanhas, "custoPorLeadCentavos", "asc").map((c) => c.nome)).toEqual([
      "Campanha A",
      "Campanha B",
    ]);
    expect(ordenarPor(campanhas, "custoPorLeadCentavos", "desc").map((c) => c.nome)).toEqual([
      "Campanha A",
      "Campanha B",
    ]);
  });
});
