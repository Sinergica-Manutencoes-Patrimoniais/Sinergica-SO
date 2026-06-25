// Domínio puro — priorização de itens de backlog do PCM pela matriz GUT.
// Regra de negócio capturada do PCM atual: cada item de manutenção é pontuado por
// Gravidade × Urgência × Tendência (cada fator de 1 a 5), gerando um score de 1 a 125 que
// ordena o backlog. Ver specs/0001-priorizacao-backlog-gut/ (AC-1..AC-4).
//
// Camada domain: sem I/O, sem framework. Invariantes garantidas na construção.

/** Fator GUT válido: inteiro de 1 a 5. */
export type FatorGut = 1 | 2 | 3 | 4 | 5;

/** Faixas de prioridade derivadas do score GUT. */
export type PrioridadeBacklog = "critica" | "alta" | "media" | "baixa";

export const SCORE_GUT_MIN = 1;
export const SCORE_GUT_MAX = 125;

function validarFator(nome: string, valor: number): asserts valor is FatorGut {
  if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
    throw new RangeError(`Fator GUT '${nome}' deve ser inteiro entre 1 e 5 (recebido: ${valor}).`);
  }
}

/**
 * Calcula o score GUT = gravidade × urgência × tendência.
 * AC-1: fatores válidos produzem o produto (1..125).
 * AC-2: qualquer fator fora de [1,5] (ou não inteiro) é rejeitado com erro.
 */
export function calcularScoreGut(gravidade: number, urgencia: number, tendencia: number): number {
  validarFator("gravidade", gravidade);
  validarFator("urgencia", urgencia);
  validarFator("tendencia", tendencia);
  return gravidade * urgencia * tendencia;
}

/**
 * Classifica a prioridade a partir do score GUT.
 * AC-3: faixas — crítica (>=100), alta (>=50), média (>=20), baixa (<20).
 */
export function classificarPrioridade(score: number): PrioridadeBacklog {
  if (!Number.isInteger(score) || score < SCORE_GUT_MIN || score > SCORE_GUT_MAX) {
    throw new RangeError(`Score GUT inválido: ${score} (esperado inteiro entre 1 e 125).`);
  }
  if (score >= 100) return "critica";
  if (score >= 50) return "alta";
  if (score >= 20) return "media";
  return "baixa";
}

/** Item mínimo para ordenação do backlog. */
export interface ItemPriorizavel {
  id: string;
  score: number;
}

/**
 * Ordena o backlog do mais crítico para o menos (score desc).
 * AC-4: empate de score mantém ordem estável de entrada (não embaralha).
 * Retorna um novo array — não muta a entrada.
 */
export function ordenarPorPrioridade<T extends ItemPriorizavel>(itens: readonly T[]): T[] {
  return itens
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => b.item.score - a.item.score || a.indice - b.indice)
    .map(({ item }) => item);
}
