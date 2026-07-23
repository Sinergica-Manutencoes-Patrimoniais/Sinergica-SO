import { validarRecorrencia } from "../domain/recorrencia-pagavel";
import type {
  EditarRecorrenciaCommand,
  FinanceiroGateway,
  RecorrenciaCommand,
} from "./financeiro-gateway";

export function listarRecorrencias(gateway: FinanceiroGateway) {
  return gateway.listarRecorrencias();
}

export function criarRecorrencia(gateway: FinanceiroGateway, input: RecorrenciaCommand) {
  const validado = validarRecorrencia(input);
  return gateway.criarRecorrencia({ ...validado, userId: input.userId });
}

export function editarRecorrencia(gateway: FinanceiroGateway, input: EditarRecorrenciaCommand) {
  const validado = validarRecorrencia(input);
  return gateway.editarRecorrencia({ ...validado, id: input.id, userId: input.userId });
}

export function desativarRecorrencia(gateway: FinanceiroGateway, id: string, userId: string) {
  return gateway.desativarRecorrencia(id, userId);
}

export function listarAgingPagaveis(gateway: FinanceiroGateway) {
  return gateway.listarAgingPagaveis();
}

export function obterProjecaoCaixa(gateway: FinanceiroGateway, horizonteDias = 90) {
  return gateway.obterProjecaoCaixa(horizonteDias);
}
