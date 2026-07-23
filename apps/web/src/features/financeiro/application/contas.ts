import { validarContaBancaria } from "../domain/conta-bancaria";
import type {
  ContaBancariaCommand,
  DesativarContaBancariaCommand,
  EditarContaBancariaCommand,
  FinanceiroGateway,
} from "./financeiro-gateway";

export function listarContas(gateway: FinanceiroGateway) {
  return gateway.listarContas();
}

export function criarConta(gateway: FinanceiroGateway, input: ContaBancariaCommand) {
  const validado = validarContaBancaria(input);
  return gateway.criarConta({ ...validado, userId: input.userId });
}

export function editarConta(gateway: FinanceiroGateway, input: EditarContaBancariaCommand) {
  const validado = validarContaBancaria(input);
  return gateway.editarConta({ ...validado, id: input.id, userId: input.userId });
}

export function desativarConta(gateway: FinanceiroGateway, input: DesativarContaBancariaCommand) {
  if (!input.id) throw new Error("Conta é obrigatória.");
  return gateway.desativarConta(input);
}
