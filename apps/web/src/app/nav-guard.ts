// E01-S108: comparação rasa entre o estado inicial e o estado atual de um formulário — usada por
// `useFormularioSujo` para decidir se a navegação deve avisar antes de descartar dados digitados.
export function formularioMudou<T extends Record<string, unknown>>(
  estadoInicial: T,
  estadoAtual: T,
): boolean {
  const chavesIniciais = Object.keys(estadoInicial);
  const chavesAtuais = Object.keys(estadoAtual);
  if (chavesIniciais.length !== chavesAtuais.length) return true;
  return chavesIniciais.some((chave) => estadoInicial[chave] !== estadoAtual[chave]);
}
