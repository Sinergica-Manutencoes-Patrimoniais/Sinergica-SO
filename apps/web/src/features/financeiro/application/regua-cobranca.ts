import { validarPontoRegua } from "../domain/regua-cobranca";
import type {
  EditarPontoReguaCommand,
  FinanceiroGateway,
  PontoReguaCommand,
} from "./financeiro-gateway";

export function listarPontosRegua(gateway: FinanceiroGateway) {
  return gateway.listarPontosRegua();
}

export function criarPontoRegua(gateway: FinanceiroGateway, input: PontoReguaCommand) {
  const validado = validarPontoRegua(input);
  return gateway.criarPontoRegua({ ...validado, userId: input.userId });
}

export function editarPontoRegua(gateway: FinanceiroGateway, input: EditarPontoReguaCommand) {
  const validado = validarPontoRegua(input);
  return gateway.editarPontoRegua({ ...validado, id: input.id, userId: input.userId });
}

export function desativarPontoRegua(gateway: FinanceiroGateway, id: string, userId: string) {
  if (!id) throw new Error("Ponto da régua é obrigatório.");
  return gateway.desativarPontoRegua(id, userId);
}

export function listarEnviosRegua(gateway: FinanceiroGateway, lancamentoId?: string) {
  return gateway.listarEnviosRegua(lancamentoId);
}
