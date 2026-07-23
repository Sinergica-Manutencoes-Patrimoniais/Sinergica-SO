import type { CobrancaTipo } from "../domain/cobranca";
import type { FinanceiroGateway } from "./financeiro-gateway";

export function emitirCobranca(
  gateway: FinanceiroGateway,
  lancamentoId: string,
  tipo: CobrancaTipo,
) {
  if (!lancamentoId) throw new Error("Recebível é obrigatório.");
  return gateway.emitirCobranca(lancamentoId, tipo);
}

export function listarCobrancasPorLancamento(gateway: FinanceiroGateway, lancamentoId: string) {
  return gateway.listarCobrancasPorLancamento(lancamentoId);
}
