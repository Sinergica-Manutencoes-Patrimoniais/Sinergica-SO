import { validarContrato } from "../domain/contrato";
import type {
  ContratoCommand,
  EditarContratoCommand,
  FinanceiroGateway,
} from "./financeiro-gateway";

export function listarContratos(gateway: FinanceiroGateway) {
  return gateway.listarContratos();
}

export function criarContrato(gateway: FinanceiroGateway, input: ContratoCommand) {
  const validado = validarContrato(input);
  return gateway.criarContrato({ ...validado, userId: input.userId });
}

export function editarContrato(gateway: FinanceiroGateway, input: EditarContratoCommand) {
  const validado = validarContrato(input);
  return gateway.editarContrato({ ...validado, id: input.id, userId: input.userId });
}

export function gerarRecorrencias(gateway: FinanceiroGateway, competencia: string) {
  return gateway.gerarRecorrencias(competencia);
}

export function listarAgingRecebiveis(gateway: FinanceiroGateway) {
  return gateway.listarAgingRecebiveis();
}
