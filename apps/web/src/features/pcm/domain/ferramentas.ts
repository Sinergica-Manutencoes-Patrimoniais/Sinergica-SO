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
  // E01-S65: só leitura — vêm do Auvo, PCM não escreve (escrita de imageUrl não confirmada
  // contra a API real ainda; codigoAuvo é o `code` humano do Auvo, distinto do id numérico).
  imagemUrl: string | null;
  codigoAuvo: string | null;
  valorUnitario: number | null;
  custoUnitario: number | null;
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
  valorUnitario?: number | null;
  custoUnitario?: number | null;
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
    valorUnitario: numeroNaoNegativoOuNull(input.valorUnitario, "Valor unitário"),
    custoUnitario: numeroNaoNegativoOuNull(input.custoUnitario, "Custo unitário"),
  };
}

/** AC-4: validação inline — mensagens por campo, sem lançar, pra UI mostrar antes do submit. */
export function validarFerramentaInline(
  input: FerramentaFormData,
): Partial<Record<keyof FerramentaFormData, string>> {
  const erros: Partial<Record<keyof FerramentaFormData, string>> = {};
  if (!input.nome.trim()) erros.nome = "Nome é obrigatório.";
  if (!Number.isInteger(input.quantidadeTotal) || input.quantidadeTotal < 0) {
    erros.quantidadeTotal = "Deve ser um número inteiro ≥ 0.";
  }
  if (!Number.isInteger(input.quantidadeMinima) || input.quantidadeMinima < 0) {
    erros.quantidadeMinima = "Deve ser um número inteiro ≥ 0.";
  } else if (input.quantidadeMinima > input.quantidadeTotal) {
    erros.quantidadeMinima = "Não pode exceder a quantidade total.";
  }
  return erros;
}

function inteiroNaoNegativo(value: number, campo: string): number {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${campo} deve ser maior ou igual a zero.`);
  return value;
}

function numeroNaoNegativoOuNull(value: number | null | undefined, campo: string): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${campo} deve ser maior ou igual a zero.`);
  }
  return value;
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
