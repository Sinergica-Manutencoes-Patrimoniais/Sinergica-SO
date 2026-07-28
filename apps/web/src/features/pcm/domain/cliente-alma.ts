// domain/cliente-alma.ts — E02-S24. "Alma" do cliente: particularidades de comunicação (síndico
// prefere áudio, é direto, etc.) que o Zé consome como contexto. Texto livre, editável.

const TAMANHO_MAXIMO = 4000;

export function validarAlma(conteudo: string): string {
  const texto = conteudo.trim();
  if (texto.length > TAMANHO_MAXIMO) {
    throw new Error(`A alma do cliente não pode passar de ${TAMANHO_MAXIMO} caracteres.`);
  }
  return texto;
}
