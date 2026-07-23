import type { FinanceiroGateway } from "./financeiro-gateway";

export function obterDreMensal(gateway: FinanceiroGateway, meses: number) {
  return gateway.obterDreMensal(meses);
}

export function obterOrcamentoRealizado(gateway: FinanceiroGateway, ano: number) {
  return gateway.obterOrcamentoRealizado(ano);
}

export function salvarOrcamentoAnual(
  gateway: FinanceiroGateway,
  categoriaId: string,
  ano: number,
  valorMensalCentavos: number,
  userId: string,
) {
  if (!categoriaId) throw new Error("Categoria é obrigatória.");
  if (!Number.isInteger(valorMensalCentavos) || valorMensalCentavos < 0) {
    throw new Error("Valor mensal deve ser zero ou positivo.");
  }
  return gateway.salvarOrcamentoAnual(categoriaId, ano, valorMensalCentavos, userId);
}
