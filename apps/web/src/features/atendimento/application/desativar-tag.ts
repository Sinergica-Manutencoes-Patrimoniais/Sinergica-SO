import type { ConfigGateway, DesativarTagCommand } from "./config-gateway";

export function desativarTag(gateway: ConfigGateway, input: DesativarTagCommand) {
  if (!input.id) throw new Error("Tag é obrigatória.");
  return gateway.desativarTag(input);
}
