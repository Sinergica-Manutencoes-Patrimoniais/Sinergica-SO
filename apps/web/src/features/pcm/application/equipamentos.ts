import { validarEquipamento, validarParentItem } from "../domain/equipamentos";
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

export async function criarEquipamento(gateway: EquipamentosGateway, input: EquipamentoCommand) {
  const validado = validarEquipamento(input);
  if (validado.parentItemId) {
    const pai = await gateway.obterItem(validado.parentItemId);
    validarParentItem(validado.clientId ?? null, pai);
  }
  return gateway.criar({ ...validado, userId: input.userId });
}

export async function editarEquipamento(
  gateway: EquipamentosGateway,
  input: EditarEquipamentoCommand,
) {
  const validado = validarEquipamento(input);
  if (validado.parentItemId) {
    const pai = await gateway.obterItem(validado.parentItemId);
    validarParentItem(validado.clientId ?? null, pai);
  }
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

/** AC-6 — resolve o caminho de instalação (Cliente>Área>Local) + Sistemas do Item, pra tela de
 * Detalhe do Item (breadcrumb + chips). */
export function obterContextoItem(gateway: EquipamentosGateway, id: string) {
  return gateway.obterContextoItem(id);
}

export function desativarEquipamento(
  gateway: EquipamentosGateway,
  input: DesativarEquipamentoCommand,
) {
  if (!input.id) throw new Error("Equipamento é obrigatório.");
  return gateway.desativar(input);
}
