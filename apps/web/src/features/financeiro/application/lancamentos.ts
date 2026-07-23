import { validarLancamento } from "../domain/lancamento";
import type {
  BaixarLancamentoCommand,
  EditarLancamentoCommand,
  EstornarBaixaLancamentoCommand,
  FiltroLancamentos,
  FinanceiroGateway,
  LancamentoCommand,
} from "./financeiro-gateway";

export function listarLancamentos(gateway: FinanceiroGateway, filtro?: FiltroLancamentos) {
  return gateway.listarLancamentos(filtro);
}

export function listarClientesOpcoes(gateway: FinanceiroGateway) {
  return gateway.listarClientesOpcoes();
}

export function criarLancamento(gateway: FinanceiroGateway, input: LancamentoCommand) {
  const validado = validarLancamento(input);
  return gateway.criarLancamento({ ...validado, userId: input.userId });
}

export function editarLancamento(gateway: FinanceiroGateway, input: EditarLancamentoCommand) {
  const validado = validarLancamento(input);
  return gateway.editarLancamento({ ...validado, id: input.id, userId: input.userId });
}

export function baixarLancamento(gateway: FinanceiroGateway, input: BaixarLancamentoCommand) {
  if (!input.dataPagamento) throw new Error("Data de pagamento é obrigatória para dar baixa.");
  return gateway.baixarLancamento(input);
}

export function estornarBaixaLancamento(
  gateway: FinanceiroGateway,
  input: EstornarBaixaLancamentoCommand,
) {
  if (!input.id) throw new Error("Lançamento é obrigatório.");
  return gateway.estornarBaixaLancamento(input);
}
