import type { ConfigGateway } from "./config-gateway";

export function listarTags(gateway: ConfigGateway) {
  return gateway.listarTags();
}
