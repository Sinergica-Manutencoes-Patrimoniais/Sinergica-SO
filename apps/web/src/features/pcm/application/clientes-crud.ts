import { validarClienteForm } from "../domain/clientes-crud";
import type {
  Cliente360Gateway,
  ClienteCommand,
  EditarClienteCommand,
  ExcluirClienteCommand,
} from "./cliente-360-gateway";

export function criarCliente(gateway: Cliente360Gateway, input: ClienteCommand) {
  if (!gateway.criarCliente) throw new Error("Gateway não implementa criação de clientes.");
  return gateway.criarCliente({ ...validarClienteForm(input), userId: input.userId });
}

export function editarCliente(gateway: Cliente360Gateway, input: EditarClienteCommand) {
  if (!gateway.editarCliente) throw new Error("Gateway não implementa edição de clientes.");
  return gateway.editarCliente({
    ...validarClienteForm(input),
    id: input.id,
    userId: input.userId,
  });
}

export function excluirCliente(gateway: Cliente360Gateway, input: ExcluirClienteCommand) {
  if (!input.id) throw new Error("Cliente é obrigatório.");
  if (!gateway.excluirCliente) throw new Error("Gateway não implementa exclusão de clientes.");
  return gateway.excluirCliente(input);
}
