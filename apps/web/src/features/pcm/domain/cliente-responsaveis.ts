// domain/cliente-responsaveis.ts — E01-S103. Responsável/representante do cliente (síndico,
// gerente predial, etc.) — cadastro local, editável, distinto dos `contacts` sincronizados do Auvo.
// E01-S111: `contato` (texto livre) virou `email` + `telefone` separados + `preferenciaContato`
// (lista fechada) — insumo futuro pro Zé saber como contatar (E02-S24/S26).

export const PREFERENCIAS_CONTATO = ["whatsapp", "ligacao", "email", "outro"] as const;
export type PreferenciaContato = (typeof PREFERENCIAS_CONTATO)[number];

export interface ResponsavelCliente {
  id: string;
  clienteId: string;
  nome: string;
  papel: string | null;
  email: string | null;
  telefone: string | null;
  preferenciaContato: PreferenciaContato | null;
}

export interface ResponsavelFormData {
  clienteId: string;
  nome: string;
  papel?: string | null;
  email?: string | null;
  telefone?: string | null;
  preferenciaContato?: PreferenciaContato | null;
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}

/** Nome é o único campo obrigatório — os demais ajudam mas não bloqueiam o cadastro. */
export function validarResponsavel(input: ResponsavelFormData): ResponsavelFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  const email = textoOuNull(input.email);
  // Best-effort (spec.md): valida presença de "@", não bloqueia formatos incomuns.
  if (email && !email.includes("@")) throw new Error("E-mail inválido.");
  if (input.preferenciaContato && !PREFERENCIAS_CONTATO.includes(input.preferenciaContato)) {
    throw new Error("Preferência de contato inválida.");
  }
  return {
    clienteId: input.clienteId,
    nome,
    papel: textoOuNull(input.papel),
    email,
    telefone: textoOuNull(input.telefone),
    preferenciaContato: input.preferenciaContato ?? null,
  };
}
