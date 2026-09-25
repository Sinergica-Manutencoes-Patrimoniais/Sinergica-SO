// E02-S31/E02-S33: gasto de IA — regra pura, sem I/O.

export type ModuloIa = "inspecao" | "atendimento" | "previsoes";

export interface GastoLogItem {
  id: string;
  modulo: ModuloIa;
  usdCost: number;
  modelo: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  refId: string | null;
  endpoint: string | null;
  createdAt: string;
}

export interface ResumoModulo {
  modulo: ModuloIa;
  usdTotal: number;
  qtde: number;
  usdMedio: number;
}

export interface ResumoGastoMes {
  usdTotal: number;
  porModulo: ResumoModulo[];
}

const MODULOS: ModuloIa[] = ["inspecao", "atendimento", "previsoes"];

/** E02-S31 AC-1: agrega os logs de um mês em total geral + total por módulo. Espera os logs já
 * filtrados pelo mês (a query/view faz o filtro — aqui só soma). */
export function resumoGastoMes(logs: GastoLogItem[]): ResumoGastoMes {
  const porModulo = MODULOS.map((modulo): ResumoModulo => {
    const doModulo = logs.filter((l) => l.modulo === modulo);
    const usdTotal = doModulo.reduce((soma, l) => soma + l.usdCost, 0);
    return {
      modulo,
      usdTotal,
      qtde: doModulo.length,
      usdMedio: doModulo.length > 0 ? usdTotal / doModulo.length : 0,
    };
  });
  return {
    usdTotal: porModulo.reduce((soma, m) => soma + m.usdTotal, 0),
    porModulo,
  };
}

export interface StatusQuota {
  percentual: number | null;
  aviso90: boolean;
  excedida: boolean;
}

/** E02-S31 AC-2: `limiteUsd` nulo ou <= 0 significa "sem limite" — nunca avisa/desabilita. */
export function verificarQuotaExcedida(usdGasto: number, limiteUsd: number | null): StatusQuota {
  if (limiteUsd === null || limiteUsd <= 0) {
    return { percentual: null, aviso90: false, excedida: false };
  }
  const percentual = (usdGasto / limiteUsd) * 100;
  return {
    percentual,
    aviso90: percentual >= 90 && percentual < 100,
    excedida: percentual >= 100,
  };
}

/** E02-S33 AC-1: "$0.0042" — 4 casas decimais porque o gasto por resposta costuma ser fração de
 * centavo (2 casas arredondaria pra "$0.00" e escondaria o custo real). */
export function formatarCustoIA(usdCost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(usdCost);
}

/** E02-S31 AC-1 (dashboard): "$X.XX" — 2 casas pra totais maiores (soma do mês), onde 4 casas
 * seria ruído visual. */
export function formatarCustoTotalIA(usdCost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdCost);
}
