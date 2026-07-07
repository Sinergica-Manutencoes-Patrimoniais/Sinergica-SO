import type { EquipeFormData, EquipeFuncionarioOpcao, EquipeItem } from "../domain/equipes";

export interface EquipeCommand extends EquipeFormData {
  userId: string;
}

export interface EditarEquipeCommand extends EquipeCommand {
  id: string;
}

export interface DesativarEquipeCommand {
  id: string;
  userId: string;
}

export interface EquipesGateway {
  listar(): Promise<EquipeItem[]>;
  listarFuncionarios(): Promise<EquipeFuncionarioOpcao[]>;
  criar(input: EquipeCommand): Promise<EquipeItem>;
  editar(input: EditarEquipeCommand): Promise<EquipeItem>;
  desativar(input: DesativarEquipeCommand): Promise<void>;
}
