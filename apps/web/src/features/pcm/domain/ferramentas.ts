export interface FerramentaItem {
  id: string;
  nome: string;
  descricao: string | null;
  categoriaId: string | null;
  categoriaNome: string | null;
  quantidadeTotal: number;
  quantidadeMinima: number;
  ativo: boolean;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface FerramentaCategoriaOpcao {
  id: string;
  nome: string;
  auvoId: number | null;
}

export interface FerramentaFormData {
  nome: string;
  descricao?: string | null;
  categoriaId?: string | null;
  quantidadeTotal: number;
  quantidadeMinima: number;
}

export interface FerramentaAlocacaoItem {
  id: string;
  ferramentaId: string;
  ferramentaNome: string;
  ferramentaAuvoId: number | null;
  quantidadeTotal: number;
  funcionarioId: string | null;
  funcionarioNome: string;
  auvoUserId: number;
  quantidade: number;
}

export interface FuncionarioFerramentaOpcao {
  id: string;
  nome: string;
  auvoUserId: number | null;
}

export interface FerramentaAlocacaoFormData {
  ferramentaId: string;
  funcionarioId: string;
  quantidade: number;
}

export function validarFerramenta(input: FerramentaFormData): FerramentaFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  const quantidadeTotal = inteiroNaoNegativo(input.quantidadeTotal, "Quantidade total");
  const quantidadeMinima = inteiroNaoNegativo(input.quantidadeMinima, "Quantidade mínima");
  if (quantidadeMinima > quantidadeTotal) {
    throw new Error("Quantidade mínima não pode exceder a quantidade total.");
  }
  return {
    nome,
    descricao: textoOuNull(input.descricao),
    categoriaId: textoOuNull(input.categoriaId),
    quantidadeTotal,
    quantidadeMinima,
  };
}

export function validarAlocacao(
  input: FerramentaAlocacaoFormData,
  ferramenta?: FerramentaItem,
  funcionario?: FuncionarioFerramentaOpcao,
): FerramentaAlocacaoFormData {
  if (!input.ferramentaId) throw new Error("Ferramenta é obrigatória.");
  if (!input.funcionarioId) throw new Error("Técnico é obrigatório.");
  const quantidade = inteiroNaoNegativo(input.quantidade, "Quantidade");
  if (!ferramenta?.auvoId) throw new Error("Sincronize a ferramenta com o Auvo antes de alocar.");
  if (!funcionario?.auvoUserId) throw new Error("Sincronize o técnico com o Auvo antes de alocar.");
  if (quantidade > ferramenta.quantidadeTotal) {
    throw new Error("Quantidade alocada excede o estoque total da ferramenta.");
  }
  return { ...input, quantidade };
}

function inteiroNaoNegativo(value: number, campo: string): number {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${campo} deve ser maior ou igual a zero.`);
  return value;
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
