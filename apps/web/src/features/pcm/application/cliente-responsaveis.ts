import { validarResponsavel } from "../domain/cliente-responsaveis";
import type { ClienteResponsaveisGateway } from "./cliente-responsaveis-gateway";

export function listarResponsaveis(gateway: ClienteResponsaveisGateway, clienteId: string) {
  return gateway.listarPorCliente(clienteId);
}

export function criarResponsavel(
  gateway: ClienteResponsaveisGateway,
  input: Parameters<typeof validarResponsavel>[0],
) {
  return gateway.criar(validarResponsavel(input));
}

export function editarResponsavel(
  gateway: ClienteResponsaveisGateway,
  id: string,
  input: Parameters<typeof validarResponsavel>[0],
) {
  return gateway.editar(id, validarResponsavel(input));
}

export function removerResponsavel(gateway: ClienteResponsaveisGateway, id: string) {
  return gateway.remover(id);
}
