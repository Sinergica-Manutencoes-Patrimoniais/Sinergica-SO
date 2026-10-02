export type ResultadoPreventiva = "pendente" | "ok" | "nao_ok";

export interface EntradaResultadoPreventiva {
  osConcluida: boolean;
  questionarioRecebido: boolean;
  respostas: ReadonlyArray<{ valor: unknown }>;
}

function normalizarResposta(valor: unknown): string | null {
  if (typeof valor !== "string") return null;

  const normalizada = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");

  return normalizada || null;
}

function estaMarcadaComo(valor: unknown, esperado: string): boolean {
  return normalizarResposta(valor) === esperado;
}

/**
 * Consolida apenas marcadores explícitos do questionário.
 * Texto livre, valores ausentes ou formatos ainda não contratados pelo Auvo não
 * são interpretados: deixam o resultado pendente para evitar falso "OK".
 */
export function consolidarResultadoPreventiva(
  entrada: EntradaResultadoPreventiva,
): ResultadoPreventiva {
  if (entrada.respostas.some(({ valor }) => estaMarcadaComo(valor, "nao ok"))) {
    return "nao_ok";
  }

  if (
    !entrada.osConcluida ||
    !entrada.questionarioRecebido ||
    entrada.respostas.length === 0
  ) {
    return "pendente";
  }

  return entrada.respostas.every(({ valor }) => estaMarcadaComo(valor, "ok"))
    ? "ok"
    : "pendente";
}
