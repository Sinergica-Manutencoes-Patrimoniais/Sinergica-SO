import type { ClienteFormData } from "../application/cliente-360-gateway";

export function validarClienteForm(input: ClienteFormData): ClienteFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  return {
    nome,
    cnpj: textoOuNull(input.cnpj),
    endereco: textoOuNull(input.endereco),
    cidade: textoOuNull(input.cidade),
    estado: textoOuNull(input.estado)?.toUpperCase() ?? null,
    cep: textoOuNull(input.cep),
    contatoNome: textoOuNull(input.contatoNome),
    contatoTelefone: textoOuNull(input.contatoTelefone),
    contatoEmail: textoOuNull(input.contatoEmail),
    observacoes: textoOuNull(input.observacoes),
  };
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
