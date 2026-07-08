import type { ConfigGateway } from "./config-gateway";

export function listarPersonas(gateway: ConfigGateway) {
  return gateway.listarPersonas();
}
