// domain/marcacoes-cliente.ts — E01-S91. Catálogo gerenciável de marcações de status de cliente
// (nome+cor), no máximo 1 marcação vigente por cliente.

export interface MarcacaoCliente {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

export interface MarcacaoClienteFormData {
  nome: string;
  cor: string;
}

const HEX_COR = /^#[0-9a-fA-F]{6}$/;

/** AC-1: nome é obrigatório, cor precisa ser um hex válido (`<input type="color">` já garante o
 * formato na UI — validado aqui de novo porque o domínio nunca confia sem checar). */
export function validarMarcacao(input: MarcacaoClienteFormData): MarcacaoClienteFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!HEX_COR.test(input.cor)) throw new Error("Cor precisa ser um hex válido (#RRGGBB).");
  return { nome, cor: input.cor };
}
