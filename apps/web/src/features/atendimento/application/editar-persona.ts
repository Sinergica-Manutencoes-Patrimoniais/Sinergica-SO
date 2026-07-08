import { validarPersona } from "../domain/personas";
import type { ConfigGateway, EditarPersonaCommand } from "./config-gateway";

export function editarPersona(gateway: ConfigGateway, input: EditarPersonaCommand) {
  if (!input.id) throw new Error("Persona é obrigatória.");
  const validado = validarPersona(input);
  return gateway.editarPersona({ ...validado, id: input.id, userId: input.userId });
}
