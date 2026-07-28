import { validarAlma } from "../domain/cliente-alma";
import type { ClienteAlmaGateway } from "./cliente-alma-gateway";

export function obterAlma(gateway: ClienteAlmaGateway, clienteId: string) {
  return gateway.obter(clienteId);
}

export function salvarAlma(
  gateway: ClienteAlmaGateway,
  clienteId: string,
  conteudo: string,
  userId: string,
) {
  return gateway.salvar(clienteId, validarAlma(conteudo), userId);
}
