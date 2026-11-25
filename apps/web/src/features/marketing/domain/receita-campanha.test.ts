import { describe, expect, it } from "vitest";
import {
  type LinhaDeReceita,
  comRetorno,
  ordenarReceita,
  totaisDeReceita,
} from "./receita-campanha";

const linhas: LinhaDeReceita[] = [
  {
    campanhaId: "c1",
    campanhaNome: "Preventiva PMOC",
    gastoCentavos: 100_000,
    leads: 20,
    oportunidades: 8,
    contratos: 2,
    receitaCentavos: 360_000,
  },
  {
    campanhaId: "c2",
    campanhaNome: "Institucional",
    gastoCentavos: 80_000,
    leads: 5,
    oportunidades: 0,
    contratos: 0,
    receitaCentavos: 0,
  },
  {
    campanhaId: "c3",
    campanhaNome: "Retrofit",
    gastoCentavos: 40_000,
    leads: 9,
    oportunidades: 3,
    contratos: 1,
    receitaCentavos: 180_000,
  },
];

describe("receita por campanha (E06-S01)", () => {
  it("AC-16: ordena pela receita, da maior para a menor", () => {
    expect(ordenarReceita(linhas).map((l) => l.campanhaNome)).toEqual([
      "Preventiva PMOC",
      "Retrofit",
      "Institucional",
    ]);
  });

  it("AC-18: campanha com gasto e sem receita continua na lista, marcada", () => {
    const ordenado = ordenarReceita(linhas);
    const institucional = ordenado.find((l) => l.campanhaId === "c2");
    expect(institucional).toBeDefined();
    expect(institucional?.receitaCentavos).toBe(0);
    expect(institucional?.semAtribuicao).toBe(true);
    expect(institucional?.retorno).toBe(0);
  });

  it("retorno sem gasto é indisponível, não infinito", () => {
    const doada = comRetorno({
      campanhaId: "c4",
      campanhaNome: "Orgânica",
      gastoCentavos: 0,
      leads: 3,
      oportunidades: 1,
      contratos: 1,
      receitaCentavos: 90_000,
    });
    expect(doada.retorno).toBeNull();
    expect(doada.semAtribuicao).toBe(false);
  });

  it("ordena por outra coluna quando pedido, com desempate por nome", () => {
    expect(ordenarReceita(linhas, "leads", "asc").map((l) => l.campanhaNome)).toEqual([
      "Institucional",
      "Retrofit",
      "Preventiva PMOC",
    ]);
  });

  it("AC-16: o total é a soma, e o retorno do total usa o gasto do total", () => {
    const totais = totaisDeReceita(linhas);
    expect(totais.gastoCentavos).toBe(220_000);
    expect(totais.receitaCentavos).toBe(540_000);
    expect(totais.contratos).toBe(3);
    expect(totais.retorno).toBeCloseTo(540_000 / 220_000);
  });

  it("lista vazia não explode e não inventa retorno", () => {
    expect(totaisDeReceita([])).toEqual({
      gastoCentavos: 0,
      leads: 0,
      oportunidades: 0,
      contratos: 0,
      receitaCentavos: 0,
      retorno: null,
    });
  });
});
