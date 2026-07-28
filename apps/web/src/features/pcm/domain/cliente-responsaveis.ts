// domain/cliente-responsaveis.ts — E01-S103. Responsável/representante do cliente (síndico,
// gerente predial, etc.) — cadastro local, editável, distinto dos `contacts` sincronizados do Auvo.

export interface ResponsavelCliente {
  id: string;
  clienteId: string;
  nome: string;
  papel: string | null;
  contato: string | null;
}

export interface ResponsavelFormData {
  clienteId: string;
  nome: string;
  papel?: string | null;
  contato?: string | null;
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}

/** Nome é o único campo obrigatório — papel/contato ajudam mas não bloqueiam o cadastro. */
export function validarResponsavel(input: ResponsavelFormData): ResponsavelFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  return {
    clienteId: input.clienteId,
    nome,
    papel: textoOuNull(input.papel),
    contato: textoOuNull(input.contato),
  };
}
