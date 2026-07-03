import type { Grupo } from "../domain/grupo";
import type { ConfigGateway } from "./config-gateway";

export async function listarGrupos(gateway: ConfigGateway): Promise<Grupo[]> {
  return gateway.listarGrupos();
}
