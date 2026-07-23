const TAMANHO_MAXIMO = 80;

/** AC-2: saneia o título bruto devolvido pela IA — o LLM às vezes envolve a resposta em aspas ou
 * quebra linha; nunca aplicamos direto no campo. Trim, remove aspas envolventes, colapsa quebras de
 * linha em espaço, trunca em 80 caracteres (declarativo/curto, não um parágrafo). */
export function sanearTituloGerado(bruto: string): string {
  const semQuebras = bruto.replace(/\s+/g, " ").trim();
  const semAspas = semQuebras.replace(/^["'“](.*)["'”]$/, "$1").trim();
  return semAspas.length > TAMANHO_MAXIMO
    ? `${semAspas.slice(0, TAMANHO_MAXIMO - 1).trimEnd()}…`
    : semAspas;
}

/** AC-2 edge case: "descrição vazia → botão desabilitado (não há de onde gerar)". */
export function podeGerarTitulo(descricao: string): boolean {
  return descricao.trim().length > 0;
}
