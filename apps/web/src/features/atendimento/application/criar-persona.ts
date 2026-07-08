import { validarPersona } from "../domain/personas";
import type { ConfigGateway, CriarPersonaCommand } from "./config-gateway";

export function criarPersona(gateway: ConfigGateway, input: CriarPersonaCommand) {
  const validado = validarPersona(input);
  return gateway.criarPersona({ ...validado, userId: input.userId });
}
