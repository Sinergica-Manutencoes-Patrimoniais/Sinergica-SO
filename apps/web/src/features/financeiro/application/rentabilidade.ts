import { validarCustoFuncionario } from "../domain/rentabilidade";
import type { CustoFuncionarioCommand, FinanceiroGateway } from "./financeiro-gateway";

export function listarFuncionariosOpcoes(gateway: FinanceiroGateway) {
  return gateway.listarFuncionariosOpcoes();
}

export function listarCustosFuncionario(gateway: FinanceiroGateway) {
  return gateway.listarCustosFuncionario();
}

export function criarCustoFuncionario(gateway: FinanceiroGateway, input: CustoFuncionarioCommand) {
  const validado = validarCustoFuncionario(input);
  return gateway.criarCustoFuncionario({ ...validado, userId: input.userId });
}

export function obterRentabilidadeClienteMes(gateway: FinanceiroGateway, meses = 12) {
  return gateway.obterRentabilidadeClienteMes(meses);
}

export function obterCustoOsPorClienteMes(
  gateway: FinanceiroGateway,
  clienteId: string,
  mes: string,
) {
  return gateway.obterCustoOsPorClienteMes(clienteId, mes);
}
