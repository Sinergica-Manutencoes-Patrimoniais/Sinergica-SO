export interface LinhaDre {
  mes: string;
  tipo: "entrada" | "saida";
  categoriaRaizNome: string;
  valorCentavos: number;
}

export interface GrupoDre {
  nome: string;
  valorCentavos: number;
}

export interface DreMensal {
  mes: string;
  receitaCentavos: number;
  despesasPorGrupo: GrupoDre[];
  despesasTotalCentavos: number;
  resultadoCentavos: number;
}

/** AC-1: agrega as linhas (mês × grupo de categoria × tipo, vindas de `fn_dre_mensal`) num DRE por
 * competência — receita, despesas por grupo, resultado líquido. Meses sem lançamento aparecem
 * zerados (edge case), nunca somem — o chamador garante isso passando a lista de meses do período. */
export function agregarDre(linhas: LinhaDre[], meses: string[]): DreMensal[] {
  return meses.map((mes) => {
    const doMes = linhas.filter((l) => l.mes === mes);
    const receitaCentavos = doMes
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + l.valorCentavos, 0);
    const despesasPorGrupo = doMes
      .filter((l) => l.tipo === "saida")
      .map((l) => ({ nome: l.categoriaRaizNome, valorCentavos: l.valorCentavos }));
    const despesasTotalCentavos = despesasPorGrupo.reduce((s, g) => s + g.valorCentavos, 0);
    return {
      mes,
      receitaCentavos,
      despesasPorGrupo,
      despesasTotalCentavos,
      resultadoCentavos: receitaCentavos - despesasTotalCentavos,
    };
  });
}

export interface OrcamentoRealizadoLinha {
  categoriaId: string;
  categoriaNome: string;
  mes: string;
  orcadoCentavos: number;
  realizadoCentavos: number;
  temOrcamento: boolean;
}

export interface DesvioOrcamento {
  categoriaId: string;
  categoriaNome: string;
  temOrcamento: boolean;
  orcadoCentavos: number;
  realizadoCentavos: number;
  desvioCentavos: number;
  desvioPercentual: number | null;
  estourou: boolean;
}

/** AC-3: desvio orçado × realizado. Categoria sem orçamento (edge case) → `temOrcamento=false`,
 * `desvioPercentual=null` (não faz sentido percentual sobre base zero) — a UI mostra só o
 * realizado, sem destacar estouro (não há meta pra estourar). */
export function calcularDesvio(
  categoriaId: string,
  categoriaNome: string,
  orcadoCentavos: number,
  realizadoCentavos: number,
  temOrcamento: boolean,
): DesvioOrcamento {
  if (!temOrcamento || orcadoCentavos === 0) {
    return {
      categoriaId,
      categoriaNome,
      temOrcamento,
      orcadoCentavos,
      realizadoCentavos,
      desvioCentavos: realizadoCentavos,
      desvioPercentual: null,
      estourou: false,
    };
  }
  const desvioCentavos = realizadoCentavos - orcadoCentavos;
  return {
    categoriaId,
    categoriaNome,
    temOrcamento,
    orcadoCentavos,
    realizadoCentavos,
    desvioCentavos,
    desvioPercentual: (desvioCentavos / orcadoCentavos) * 100,
    estourou: desvioCentavos > 0,
  };
}
