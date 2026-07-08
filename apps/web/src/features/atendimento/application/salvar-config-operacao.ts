import { validarConfigOperacao } from "../domain/operacao";
import type { ConfigOperacaoFormData } from "../domain/operacao";
import type { ConfigGateway, SalvarConfigOperacaoGatewayInput } from "./config-gateway";

export async function salvarConfigOperacao(
  gateway: ConfigGateway,
  input: ConfigOperacaoFormData & { personaId: string; userId: string },
) {
  const validado = validarConfigOperacao(input);
  const command: SalvarConfigOperacaoGatewayInput = {
    ...validado,
    personaId: input.personaId,
    userId: input.userId,
  };
  return gateway.salvarConfigOperacao(command);
}
