import type { TipoTarefa, TipoTarefaFormData } from "../domain/tipos-tarefa";

export interface CriarTipoTarefaInput extends TipoTarefaFormData {
  userId: string;
}

export interface EditarTipoTarefaInput extends TipoTarefaFormData {
  id: string;
  userId: string;
}

export interface ExcluirTipoTarefaInput {
  id: string;
  userId: string;
}

export interface TiposTarefaGateway {
  listar(): Promise<TipoTarefa[]>;
  criar(input: CriarTipoTarefaInput): Promise<TipoTarefa>;
  editar(input: EditarTipoTarefaInput): Promise<TipoTarefa>;
  excluir(input: ExcluirTipoTarefaInput): Promise<void>;
}
