import type { PontoFluxoMensal } from "./dashboard";

/** AC-1: burn médio mensal (saídas − entradas realizadas) — só meses já fechados/realizados
 * entram no fluxo mensal (fn_fluxo_mensal já filtra `status='realizado'`). Burn ≤ 0 = a empresa
 * está gerando caixa no período, não queimando (edge case "burn negativo = lucrativo"). */
export function calcularBurnMedioCentavos(pontos: PontoFluxoMensal[]): number {
  if (pontos.length === 0) return 0;
  const totalBurn = pontos.reduce((soma, p) => soma + (p.saidasCentavos - p.entradasCentavos), 0);
  return totalBurn / pontos.length;
}

/** AC-1: quantos meses o caixa dura no ritmo atual. `null` = runway "infinito" (burn ≤ 0, saudável
 * por definição — nunca divide por zero). Saldo já negativo/zerado com burn positivo → 0 (esgotado). */
export function calcularRunwayMeses(
  saldoAtualCentavos: number,
  burnMedioCentavos: number,
): number | null {
  if (burnMedioCentavos <= 0) return null;
  if (saldoAtualCentavos <= 0) return 0;
  return saldoAtualCentavos / burnMedioCentavos;
}

/** AC-2: faturamento necessário pra empatar no mês, a partir da margem de contribuição histórica
 * observada (resultado médio / entradas médias). Margem ≤ 0 (nunca fechou no positivo no período)
 * → `null`, "não atingível no ritmo atual" (edge case — não inventa um número sem sentido). */
export function calcularBreakEvenCentavos(
  despesasMediasCentavos: number,
  margemContribuicao: number,
): number | null {
  if (margemContribuicao <= 0) return null;
  return Math.round(despesasMediasCentavos / margemContribuicao);
}

/** Margem de contribuição observada no período — resultado médio / entrada média. `null` se não
 * houve entrada (sem base pra calcular). */
export function calcularMargemContribuicao(pontos: PontoFluxoMensal[]): number | null {
  const totalEntradas = pontos.reduce((s, p) => s + p.entradasCentavos, 0);
  if (totalEntradas <= 0) return null;
  const totalResultado = pontos.reduce((s, p) => s + p.resultadoCentavos, 0);
  return totalResultado / totalEntradas;
}

export function calcularDespesasMediasCentavos(pontos: PontoFluxoMensal[]): number {
  if (pontos.length === 0) return 0;
  return pontos.reduce((s, p) => s + p.saidasCentavos, 0) / pontos.length;
}

/** AC-4: ticket médio = receita / quantidade de clientes com receita no período (evita diluir por
 * clientes zerados). */
export function calcularTicketMedioCentavos(
  receitaCentavos: number,
  quantidadeClientes: number,
): number {
  if (quantidadeClientes <= 0) return 0;
  return Math.round(receitaCentavos / quantidadeClientes);
}

/** Edge case "dados insuficientes → marca amostra pequena, não mente": indicadores derivados de
 * média histórica (runway/break-even) exigem pelo menos 3 meses fechados pra não virar ruído. */
export function amostraPequena(mesesDisponiveis: number): boolean {
  return mesesDisponiveis < 3;
}
