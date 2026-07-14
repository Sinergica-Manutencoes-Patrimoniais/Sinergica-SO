import type {
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

export interface FerramentasGateway {
  listar(): Promise<FerramentaItem[]>;
  listarCategorias(): Promise<FerramentaCategoriaOpcao[]>;
  criar(input: FerramentaCommand): Promise<FerramentaItem>;
  editar(input: EditarFerramentaCommand): Promise<FerramentaItem>;
  desativar(input: DesativarFerramentaCommand): Promise<void>;
}

/** `listarAlocacoes` é a visão AGREGADA do Auvo (`employeesStock`, reconciliada pelo cron) — usada
 * só pro badge de divergência (E01-S63, AC-7) contra a contagem real de `ferramenta_unidades` do
 * PCM. PCM não escreve mais nela; posse/histórico de verdade vive em
 * `FerramentaUnidadesGateway` (ferramenta-unidades-gateway.ts). */
export interface FerramentaAlocacoesGateway {
  listarFerramentas(): Promise<FerramentaItem[]>;
  listarFuncionarios(): Promise<FuncionarioFerramentaOpcao[]>;
  listarAlocacoes(): Promise<FerramentaAlocacaoItem[]>;
}
