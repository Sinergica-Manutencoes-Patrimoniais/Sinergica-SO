import type {
  AtribuirUnidadeFormData,
  BaixarUnidadeFormData,
  DevolverUnidadeFormData,
  FerramentaUnidadeItem,
  MovimentacaoFerramentaItem,
} from "../domain/ferramenta-unidades";

export interface GerarUnidadesCommand {
  ferramentaId: string;
  quantidade: number;
  userId: string;
}

export interface AtribuirUnidadeCommand extends AtribuirUnidadeFormData {
  userId: string;
}

export interface DevolverUnidadeCommand extends DevolverUnidadeFormData {
  userId: string;
}

export interface BaixarUnidadeCommand extends BaixarUnidadeFormData {
  userId: string;
}

export interface FerramentaUnidadesGateway {
  listarUnidades(): Promise<FerramentaUnidadeItem[]>;
  listarHistoricoUnidade(unidadeId: string): Promise<MovimentacaoFerramentaItem[]>;
  listarHistoricoFuncionario(funcionarioId: string): Promise<MovimentacaoFerramentaItem[]>;
  gerarUnidades(input: GerarUnidadesCommand): Promise<FerramentaUnidadeItem[]>;
  atribuir(input: AtribuirUnidadeCommand): Promise<void>;
  devolver(input: DevolverUnidadeCommand): Promise<void>;
  baixar(input: BaixarUnidadeCommand): Promise<void>;
}
