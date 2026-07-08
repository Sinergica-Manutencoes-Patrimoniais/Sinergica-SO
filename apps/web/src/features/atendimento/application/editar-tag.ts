import { validarTag } from "../domain/tags";
import type { ConfigGateway, EditarTagCommand } from "./config-gateway";

export function editarTag(gateway: ConfigGateway, input: EditarTagCommand) {
  if (!input.id) throw new Error("Tag é obrigatória.");
  const validado = validarTag(input);
  return gateway.editarTag({ ...validado, id: input.id, userId: input.userId });
}
