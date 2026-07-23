export interface ResumoCaixa {
  posicaoCaixaCentavos: number;
  entradasMesCentavos: number;
  saidasMesCentavos: number;
  resultadoMesCentavos: number;
  aReceber30dCentavos: number;
  aPagar30dCentavos: number;
  entradasPrevistasMesCentavos: number;
  saidasPrevistasMesCentavos: number;
}

export interface PontoFluxoMensal {
  mes: string; // ISO date do 1º dia do mês
  entradasCentavos: number;
  saidasCentavos: number;
  resultadoCentavos: number;
}

export interface GastoCategoria {
  categoriaId: string;
  totalCentavos: number;
}

export interface GastoCategoriaAgregado {
  categoriaId: string;
  nome: string;
  totalCentavos: number;
  percentual: number;
}

const MES_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });

export function formatarMesCurto(isoDate: string): string {
  return MES_LABEL.format(new Date(`${isoDate}T00:00:00`)).replace(".", "");
}

/** Agrega gastos por categoria raiz (soma o próprio + subcategorias), ordenado desc, com % do
 * total. `categorias` é a árvore já carregada (id/nome/parentId) usada só pra resolver hierarquia. */
export function agregarGastosPorRaiz(
  gastos: GastoCategoria[],
  categorias: { id: string; nome: string; parentId: string | null }[],
): GastoCategoriaAgregado[] {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const totalPorRaiz = new Map<string, number>();

  for (const gasto of gastos) {
    const categoria = porId.get(gasto.categoriaId);
    const raizId = categoria?.parentId ?? gasto.categoriaId;
    totalPorRaiz.set(raizId, (totalPorRaiz.get(raizId) ?? 0) + gasto.totalCentavos);
  }

  const totalGeral = [...totalPorRaiz.values()].reduce((soma, v) => soma + v, 0);

  return [...totalPorRaiz.entries()]
    .map(([categoriaId, totalCentavos]) => ({
      categoriaId,
      nome: porId.get(categoriaId)?.nome ?? "Sem categoria",
      totalCentavos,
      percentual: totalGeral > 0 ? (totalCentavos / totalGeral) * 100 : 0,
    }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos);
}
