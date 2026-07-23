import type { FinanceiroGateway } from "./financeiro-gateway";

export function obterResumoCaixa(gateway: FinanceiroGateway) {
  return gateway.obterResumoCaixa();
}

export function obterFluxoMensal(gateway: FinanceiroGateway, meses = 12) {
  return gateway.obterFluxoMensal(meses);
}

export function obterGastosCategoria(gateway: FinanceiroGateway, inicio: string, fim: string) {
  return gateway.obterGastosCategoria(inicio, fim);
}
