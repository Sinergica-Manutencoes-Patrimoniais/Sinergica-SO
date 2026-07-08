import type { ConfigGateway } from "./config-gateway";

export function buscarConfigCanal(gateway: ConfigGateway, clientId: string) {
  if (!clientId) throw new Error("Cliente é obrigatório.");
  return gateway.buscarConfigCanal(clientId);
}
