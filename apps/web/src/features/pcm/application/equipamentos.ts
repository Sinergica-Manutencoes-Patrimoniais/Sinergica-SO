import { validarEquipamento } from "../domain/equipamentos";
import type {
  DesativarEquipamentoCommand,
  EditarEquipamentoCommand,
  EquipamentoCommand,
  EquipamentosGateway,
} from "./equipamentos-gateway";

export function listarEquipamentos(gateway: EquipamentosGateway) {
  return gateway.listar();
}

export function listarClientesEquipamento(gateway: EquipamentosGateway) {
  return gateway.listarClientes();
}

export function criarEquipamento(gateway: EquipamentosGateway, input: EquipamentoCommand) {
  const validado = validarEquipamento(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarEquipamento(gateway: EquipamentosGateway, input: EditarEquipamentoCommand) {
  const validado = validarEquipamento(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function desativarEquipamento(
  gateway: EquipamentosGateway,
  input: DesativarEquipamentoCommand,
) {
  if (!input.id) throw new Error("Equipamento é obrigatório.");
  return gateway.desativar(input);
}
