import { validarIgAutomation, validarOptOut } from "../domain/automacao";
import type { IgAutomationFormData, OptOutFormData } from "../domain/automacao";
import type { AutomacaoGateway } from "./automacao-gateway";

export async function listarIgAutomations(gateway: AutomacaoGateway) {
  return gateway.listarIgAutomations();
}

export async function criarIgAutomation(
  gateway: AutomacaoGateway,
  input: IgAutomationFormData & { userId: string },
) {
  const validado = validarIgAutomation(input);
  return gateway.criarIgAutomation({ ...validado, userId: input.userId });
}

export async function desativarIgAutomation(gateway: AutomacaoGateway, id: string) {
  return gateway.desativarIgAutomation(id);
}

export async function listarOptOuts(gateway: AutomacaoGateway) {
  return gateway.listarOptOuts();
}

export async function removerOptOut(gateway: AutomacaoGateway, id: string) {
  return gateway.removerOptOut(id);
}

export function criarOptOut(gateway: AutomacaoGateway, input: OptOutFormData & { userId: string }) {
  return gateway.criarOptOut({ ...validarOptOut(input), userId: input.userId });
}
