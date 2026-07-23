export type FaixaAging = "a_vencer" | "d1_3" | "d4_7" | "d8_15" | "d15_mais";

export interface RecebivelAging {
  lancamentoId: string;
  clienteId: string | null;
  contratoId: string | null;
  valorCentavos: number;
  dataVencimento: string;
  descricao: string | null;
  faixa: FaixaAging;
  diasAtraso: number;
}

export const ORDEM_FAIXAS: FaixaAging[] = ["a_vencer", "d1_3", "d4_7", "d8_15", "d15_mais"];

export const LABEL_FAIXA: Record<FaixaAging, string> = {
  a_vencer: "A vencer",
  d1_3: "1-3 dias",
  d4_7: "4-7 dias",
  d8_15: "8-15 dias",
  d15_mais: "+15 dias",
};

/** Alerta a partir de D+3 (AC-4). */
export function ehAlerta(faixa: FaixaAging): boolean {
  return faixa !== "a_vencer";
}

/** Genérico o bastante pra agrupar tanto recebíveis quanto pagáveis (mesmo shape de faixa/dias). */
export function agruparPorFaixa<T extends { faixa: FaixaAging }>(
  itens: T[],
): Record<FaixaAging, T[]> {
  const grupos: Record<FaixaAging, T[]> = {
    a_vencer: [],
    d1_3: [],
    d4_7: [],
    d8_15: [],
    d15_mais: [],
  };
  for (const item of itens) grupos[item.faixa].push(item);
  return grupos;
}

export interface InadimplenciaCliente {
  clienteId: string;
  totalAtrasoCentavos: number;
  diasMaisAntigo: number;
  quantidade: number;
}

/** Agrupa vencidos (faixas != a_vencer) por cliente: total em atraso, dias do mais antigo,
 * quantidade de recebíveis vencidos (AC-5). */
export function agruparInadimplenciaPorCliente(
  recebiveis: RecebivelAging[],
): InadimplenciaCliente[] {
  const vencidos = recebiveis.filter((r) => ehAlerta(r.faixa) && r.clienteId);
  const porCliente = new Map<string, InadimplenciaCliente>();

  for (const r of vencidos) {
    const clienteId = r.clienteId as string;
    const atual = porCliente.get(clienteId) ?? {
      clienteId,
      totalAtrasoCentavos: 0,
      diasMaisAntigo: 0,
      quantidade: 0,
    };
    atual.totalAtrasoCentavos += r.valorCentavos;
    atual.diasMaisAntigo = Math.max(atual.diasMaisAntigo, r.diasAtraso);
    atual.quantidade += 1;
    porCliente.set(clienteId, atual);
  }

  return [...porCliente.values()].sort((a, b) => b.totalAtrasoCentavos - a.totalAtrasoCentavos);
}

/** % da carteira (todos os recebíveis previstos, vencidos ou não) que está em atraso, em valor. */
export function percentualCarteiraEmAtraso(recebiveis: RecebivelAging[]): number {
  const total = recebiveis.reduce((soma, r) => soma + r.valorCentavos, 0);
  if (total === 0) return 0;
  const vencido = recebiveis
    .filter((r) => ehAlerta(r.faixa))
    .reduce((soma, r) => soma + r.valorCentavos, 0);
  return (vencido / total) * 100;
}
