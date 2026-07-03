import type { ConfigGateway, UsuarioConfig } from "./config-gateway";

export async function listarUsuarios(gateway: ConfigGateway): Promise<UsuarioConfig[]> {
  return gateway.listarUsuarios();
}
