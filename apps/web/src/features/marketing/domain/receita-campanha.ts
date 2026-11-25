/** Receita por campanha — "qual campanha gerou receita" (E06-S01, AC-16/AC-18).
 *
 * O Marketing **referencia** o Comercial, não o reimplementa (ADR-1699 §2): oportunidade,
 * proposta e contrato continuam sendo de lá. Aqui só se lê o que a RPC
 * `marketing.fn_receita_por_campanha` já juntou, e se põe em ordem de decisão. */

export interface LinhaDeReceita {
  readonly campanhaId: string;
  readonly campanhaNome: string;
  readonly gastoCentavos: number;
  readonly leads: number;
  readonly oportunidades: number;
  readonly contratos: number;
  readonly receitaCentavos: number;
}

export interface LinhaDeReceitaComRetorno extends LinhaDeReceita {
  /** Receita ÷ gasto. `null` sem gasto — "retorno infinito" não é informação. */
  readonly retorno: number | null;
  /** `true` quando a campanha gastou e nada foi atribuído a ela. Não é erro: é o achado. */
  readonly semAtribuicao: boolean;
}

export function comRetorno(linha: LinhaDeReceita): LinhaDeReceitaComRetorno {
  return {
    ...linha,
    retorno: linha.gastoCentavos > 0 ? linha.receitaCentavos / linha.gastoCentavos : null,
    semAtribuicao: linha.gastoCentavos > 0 && linha.receitaCentavos === 0,
  };
}

export type ColunaDeReceita = keyof Pick<
  LinhaDeReceita,
  "gastoCentavos" | "leads" | "oportunidades" | "contratos" | "receitaCentavos"
>;

/** AC-18: campanha sem atribuição **continua na lista**, com receita zero. Escondê-la deixaria o
 * gasto sem retorno invisível, que é exatamente o que este relatório existe para mostrar. Por
 * isso não há filtro aqui — só ordenação. */
export function ordenarReceita(
  linhas: readonly LinhaDeReceita[],
  coluna: ColunaDeReceita = "receitaCentavos",
  sentido: "asc" | "desc" = "desc",
): LinhaDeReceitaComRetorno[] {
  return [...linhas].map(comRetorno).sort((a, b) => {
    const diferenca = sentido === "asc" ? a[coluna] - b[coluna] : b[coluna] - a[coluna];
    return diferenca !== 0 ? diferenca : a.campanhaNome.localeCompare(b.campanhaNome, "pt-BR");
  });
}

export interface TotaisDeReceita {
  readonly gastoCentavos: number;
  readonly leads: number;
  readonly oportunidades: number;
  readonly contratos: number;
  readonly receitaCentavos: number;
  readonly retorno: number | null;
}

export function totaisDeReceita(linhas: readonly LinhaDeReceita[]): TotaisDeReceita {
  const somas = linhas.reduce(
    (total, linha) => ({
      gastoCentavos: total.gastoCentavos + linha.gastoCentavos,
      leads: total.leads + linha.leads,
      oportunidades: total.oportunidades + linha.oportunidades,
      contratos: total.contratos + linha.contratos,
      receitaCentavos: total.receitaCentavos + linha.receitaCentavos,
    }),
    { gastoCentavos: 0, leads: 0, oportunidades: 0, contratos: 0, receitaCentavos: 0 },
  );
  return {
    ...somas,
    retorno: somas.gastoCentavos > 0 ? somas.receitaCentavos / somas.gastoCentavos : null,
  };
}
