import type { PermissaoModulo } from "../domain/grupo";
import type { ConfigGateway } from "./config-gateway";

export async function resolverMinhasPermissoes(gateway: ConfigGateway): Promise<PermissaoModulo[]> {
  return gateway.minhasPermissoes();
}
