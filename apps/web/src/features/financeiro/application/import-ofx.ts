import { aplicarRegraClassificacao, candidatosConciliacao } from "../domain/conciliacao";
import type {
  ExtratoTransacaoItem,
  LancamentoPrevistoCandidato,
  RegraClassificacao,
} from "../domain/conciliacao";
import { parseOfx } from "../domain/ofx";
import type {
  ConciliarTransacaoCommand,
  CriarLancamentoDeTransacaoCommand,
  FinanceiroGateway,
  RegraClassificacaoCommand,
} from "./financeiro-gateway";

export function processarArquivoOfx(texto: string) {
  return parseOfx(texto);
}

export function importarExtrato(gateway: FinanceiroGateway, contaId: string, texto: string) {
  const { transacoes } = processarArquivoOfx(texto);
  return gateway.importarExtrato(contaId, transacoes);
}

export function listarTransacoesPendentes(gateway: FinanceiroGateway, contaId?: string) {
  return gateway.listarTransacoesPendentes(contaId);
}

export function listarRegrasClassificacao(gateway: FinanceiroGateway) {
  return gateway.listarRegrasClassificacao();
}

export function criarRegraClassificacao(
  gateway: FinanceiroGateway,
  input: RegraClassificacaoCommand,
) {
  if (!input.padrao.trim()) throw new Error("Padrão é obrigatório.");
  return gateway.criarRegraClassificacao(input);
}

export async function sugerirClassificacao(
  gateway: FinanceiroGateway,
  transacao: ExtratoTransacaoItem,
) {
  const regras = await gateway.listarRegrasClassificacao();
  return aplicarRegraClassificacao(transacao.memo, regras);
}

export async function buscarCandidatosConciliacao(
  gateway: FinanceiroGateway,
  transacao: ExtratoTransacaoItem,
): Promise<LancamentoPrevistoCandidato[]> {
  const previstos = await gateway.listarLancamentosPrevistosPorConta(transacao.contaId);
  return candidatosConciliacao(transacao, previstos);
}

export function conciliarTransacao(gateway: FinanceiroGateway, input: ConciliarTransacaoCommand) {
  return gateway.conciliarTransacao(input);
}

export function desfazerConciliacao(
  gateway: FinanceiroGateway,
  transacaoId: string,
  userId: string,
) {
  return gateway.desfazerConciliacao(transacaoId, userId);
}

export function criarLancamentoDeTransacao(
  gateway: FinanceiroGateway,
  input: CriarLancamentoDeTransacaoCommand,
) {
  if (!input.categoriaId) throw new Error("Categoria é obrigatória.");
  return gateway.criarLancamentoDeTransacao(input);
}

export function ignorarTransacao(gateway: FinanceiroGateway, transacaoId: string) {
  return gateway.ignorarTransacao(transacaoId);
}

export function reverterIgnorarTransacao(gateway: FinanceiroGateway, transacaoId: string) {
  return gateway.reverterIgnorarTransacao(transacaoId);
}

export type { RegraClassificacao };
