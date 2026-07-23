import { validarConfigImpostos } from "../domain/impostos";
import type { ConfigImpostos } from "../domain/impostos";
import type { FinanceiroGateway } from "./financeiro-gateway";

export function obterConfigImpostos(gateway: FinanceiroGateway) {
  return gateway.obterConfigImpostos();
}

export function salvarConfigImpostos(
  gateway: FinanceiroGateway,
  input: ConfigImpostos & { userId: string },
) {
  const validado = validarConfigImpostos(input);
  return gateway.salvarConfigImpostos({ ...validado, userId: input.userId });
}

export function provisionarImposto(gateway: FinanceiroGateway, competencia: string) {
  if (!competencia) throw new Error("Competência é obrigatória.");
  return gateway.provisionarImposto(competencia);
}

export function listarProvisoesImposto(gateway: FinanceiroGateway) {
  return gateway.listarProvisoesImposto();
}
