import { validarEquipe } from "../domain/equipes";
import type {
  DesativarEquipeCommand,
  EditarEquipeCommand,
  EquipeCommand,
  EquipesGateway,
} from "./equipes-gateway";

export function listarEquipes(gateway: EquipesGateway) {
  return gateway.listar();
}

export function listarFuncionariosEquipe(gateway: EquipesGateway) {
  return gateway.listarFuncionarios();
}

export async function criarEquipe(gateway: EquipesGateway, input: EquipeCommand) {
  const funcionarios = await gateway.listarFuncionarios();
  const validado = validarEquipe(input, funcionarios);
  return gateway.criar({ ...validado, userId: input.userId });
}

export async function editarEquipe(gateway: EquipesGateway, input: EditarEquipeCommand) {
  const funcionarios = await gateway.listarFuncionarios();
  const validado = validarEquipe(input, funcionarios);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function desativarEquipe(gateway: EquipesGateway, input: DesativarEquipeCommand) {
  if (!input.id) throw new Error("Equipe é obrigatória.");
  return gateway.desativar(input);
}
