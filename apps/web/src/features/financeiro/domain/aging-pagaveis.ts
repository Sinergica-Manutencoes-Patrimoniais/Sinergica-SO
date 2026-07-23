import type { FaixaAging } from "./aging";

export interface PagavelAging {
  lancamentoId: string;
  fornecedorId: string | null;
  categoriaId: string;
  contaId: string | null;
  valorCentavos: number;
  dataVencimento: string;
  descricao: string | null;
  faixa: FaixaAging;
  diasAtraso: number;
}

export { agruparPorFaixa, ehAlerta, LABEL_FAIXA, ORDEM_FAIXAS } from "./aging";
