import { validarTag } from "../domain/tags";
import type { ConfigGateway, CriarTagCommand } from "./config-gateway";

export function criarTag(gateway: ConfigGateway, input: CriarTagCommand) {
  const validado = validarTag(input);
  return gateway.criarTag({ ...validado, userId: input.userId });
}
