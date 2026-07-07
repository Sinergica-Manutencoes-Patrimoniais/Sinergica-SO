import type {
  FerramentaAlocacaoFormData,
  FerramentaAlocacaoItem,
  FerramentaCategoriaOpcao,
  FerramentaFormData,
  FerramentaItem,
  FuncionarioFerramentaOpcao,
} from "../domain/ferramentas";

export interface FerramentaCommand extends FerramentaFormData {
  userId: string;
}

export interface EditarFerramentaCommand extends FerramentaCommand {
  id: string;
}

export interface DesativarFerramentaCommand {
  id: string;
  userId: string;
}

export interface AlocarFerramentaCommand extends FerramentaAlocacaoFormData {
  userId: string;
}

export interface FerramentasGateway {
  listar(): Promise<FerramentaItem[]>;
  listarCategorias(): Promise<FerramentaCategoriaOpcao[]>;
  criar(input: FerramentaCommand): Promise<FerramentaItem>;
  editar(input: EditarFerramentaCommand): Promise<FerramentaItem>;
  desativar(input: DesativarFerramentaCommand): Promise<void>;
}

export interface FerramentaAlocacoesGateway {
  listarFerramentas(): Promise<FerramentaItem[]>;
  listarFuncionarios(): Promise<FuncionarioFerramentaOpcao[]>;
  listarAlocacoes(): Promise<FerramentaAlocacaoItem[]>;
  alocar(input: AlocarFerramentaCommand): Promise<void>;
}
