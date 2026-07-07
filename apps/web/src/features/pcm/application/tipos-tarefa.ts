import { validarTipoTarefa } from "../domain/tipos-tarefa";
import type {
  CriarTipoTarefaInput,
  EditarTipoTarefaInput,
  ExcluirTipoTarefaInput,
  TiposTarefaGateway,
} from "./tipos-tarefa-gateway";

export function listarTiposTarefa(gateway: TiposTarefaGateway) {
  return gateway.listar();
}

export function criarTipoTarefa(gateway: TiposTarefaGateway, input: CriarTipoTarefaInput) {
  const validado = validarTipoTarefa(input);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function editarTipoTarefa(gateway: TiposTarefaGateway, input: EditarTipoTarefaInput) {
  const validado = validarTipoTarefa(input);
  return gateway.editar({ ...validado, id: input.id, userId: input.userId });
}

export function excluirTipoTarefa(gateway: TiposTarefaGateway, input: ExcluirTipoTarefaInput) {
  if (!input.id) throw new Error("Tipo de tarefa é obrigatório.");
  return gateway.excluir(input);
}
