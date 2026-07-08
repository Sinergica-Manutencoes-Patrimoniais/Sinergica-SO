import type { ConhecimentoEntradaItem, ConhecimentoEntradaValidado } from "../domain/conhecimento";

export interface CriarConhecimentoEntradaInput extends ConhecimentoEntradaValidado {
  userId: string;
}

export interface EditarConhecimentoEntradaInput extends ConhecimentoEntradaValidado {
  id: string;
  userId: string;
}

export interface ConhecimentoGateway {
  listarEntradas(): Promise<ConhecimentoEntradaItem[]>;
  criarEntrada(input: CriarConhecimentoEntradaInput): Promise<ConhecimentoEntradaItem>;
  editarEntrada(input: EditarConhecimentoEntradaInput): Promise<ConhecimentoEntradaItem>;
  desativarEntrada(id: string): Promise<void>;
}
