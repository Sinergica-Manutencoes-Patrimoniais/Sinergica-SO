import type { PermissaoModulo } from "../domain/grupo";
import type { ConfigGateway } from "./config-gateway";

export async function resolverPermissoesDe(
  gateway: ConfigGateway,
  userId: string,
): Promise<PermissaoModulo[]> {
  return gateway.resolverPermissoesDe(userId);
}
