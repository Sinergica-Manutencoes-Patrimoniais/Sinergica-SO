import type { ConfigGateway } from "./config-gateway";

export function listarClientesConfig(gateway: ConfigGateway) {
  return gateway.listarClientes();
}
