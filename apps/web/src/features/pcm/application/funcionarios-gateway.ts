import type {
  CriarFuncionarioFormData,
  FuncionarioFormData,
  FuncionarioItem,
} from "../domain/funcionarios";

export interface CriarFuncionarioCommand extends CriarFuncionarioFormData {
  userId: string;
}

export interface EditarFuncionarioCommand extends FuncionarioFormData {
  id: string;
  userId: string;
}

export interface DesativarFuncionarioCommand {
  id: string;
  userId: string;
}

export interface FuncionariosGateway {
  listar(): Promise<FuncionarioItem[]>;
  criar(input: CriarFuncionarioCommand): Promise<FuncionarioItem>;
  editar(input: EditarFuncionarioCommand): Promise<FuncionarioItem>;
  desativar(input: DesativarFuncionarioCommand): Promise<void>;
}
