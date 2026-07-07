import { validarCriacaoFuncionario, validarFuncionario } from "../domain/funcionarios";
import type {
  CriarFuncionarioCommand,
  DesativarFuncionarioCommand,
  EditarFuncionarioCommand,
  FuncionariosGateway,
} from "./funcionarios-gateway";

export function listarFuncionarios(gateway: FuncionariosGateway) {
  return gateway.listar();
}

export function criarFuncionario(gateway: FuncionariosGateway, input: CriarFuncionarioCommand) {
  const validado = validarCriacaoFuncionario(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarFuncionario(gateway: FuncionariosGateway, input: EditarFuncionarioCommand) {
  const validado = validarFuncionario(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function desativarFuncionario(
  gateway: FuncionariosGateway,
  input: DesativarFuncionarioCommand,
) {
  if (!input.id) throw new Error("Funcionário é obrigatório.");
  return gateway.desativar(input);
}
