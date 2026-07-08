import { validarConfigIa } from "../domain/personas";
import type { ConfigIaFormData } from "../domain/personas";
import type { ConfigGateway, SalvarConfigIaGatewayInput } from "./config-gateway";

export async function salvarConfigIa(
  gateway: ConfigGateway,
  input: ConfigIaFormData & { personaId: string; userId: string },
) {
  const validado = validarConfigIa(input);
  const command: SalvarConfigIaGatewayInput = {
    ...validado,
    personaId: input.personaId,
    userId: input.userId,
  };
  return gateway.salvarConfigIa(command);
}
