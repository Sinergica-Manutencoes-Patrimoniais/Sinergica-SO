import { validarClienteGrupo } from "../domain/cliente-grupos";
import type {
  ClienteGrupoCommand,
  ClienteGruposGateway,
  EditarClienteGrupoCommand,
  ExcluirClienteGrupoCommand,
} from "./cliente-grupos-gateway";

export function listarClienteGrupos(gateway: ClienteGruposGateway) {
  return gateway.listar();
}

export function listarClientesSincronizadosParaGrupo(gateway: ClienteGruposGateway) {
  return gateway.listarClientesSincronizados();
}

export function criarClienteGrupo(gateway: ClienteGruposGateway, input: ClienteGrupoCommand) {
  const validado = validarClienteGrupo(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarClienteGrupo(
  gateway: ClienteGruposGateway,
  input: EditarClienteGrupoCommand,
) {
  const validado = validarClienteGrupo(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function excluirClienteGrupo(
  gateway: ClienteGruposGateway,
  input: ExcluirClienteGrupoCommand,
) {
  if (!input.id) throw new Error("Grupo é obrigatório.");
  return gateway.excluir(input);
}
