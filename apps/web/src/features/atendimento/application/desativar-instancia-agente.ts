import type { ConfigGateway, DesativarInstanciaAgenteCommand } from "./config-gateway";

export function desativarInstanciaAgente(
  gateway: ConfigGateway,
  input: DesativarInstanciaAgenteCommand,
) {
  if (!input.id) throw new Error("Instância é obrigatória.");
  return gateway.desativarInstanciaAgente(input);
}
