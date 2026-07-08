import type { ConfigGateway, DesativarPersonaCommand } from "./config-gateway";

export function desativarPersona(gateway: ConfigGateway, input: DesativarPersonaCommand) {
  if (!input.id) throw new Error("Persona é obrigatória.");
  return gateway.desativarPersona(input);
}
