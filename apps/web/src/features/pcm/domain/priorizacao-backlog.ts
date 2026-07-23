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

// ── E01-S82: GUTD (Gravidade·Urgência·Tendência·Dor do cliente), pesos configuráveis ──────────
// Substitui o produto G×U×T por uma MÉDIA PONDERADA — nunca gravada, sempre recalculada em
// runtime (mesmo princípio do Hub de OS, E01-S07), porque os pesos podem mudar a qualquer momento
// na config do superadmin e um valor gravado ficaria desatualizado. `calcularScoreGut`/
// `classificarPrioridade` (produto, 1-125) continuam existindo — não removidos, só superados como
// critério de ordenação padrão do backlog/hub (AC-2).

/** Pesos em pontos percentuais (0-100), somando exatamente 100 — validado por `validarPesosGutd`. */
export interface PesosGutd {
  gravidade: number;
  urgencia: number;
  tendencia: number;
  dorCliente: number;
}

/** AC-3: fallback seguro documentado na spec ("default a confirmar com Fabrício — pesos iguais
 * como fallback") — usado até a config real ser definida. */
export const PESOS_GUTD_PADRAO: PesosGutd = {
  gravidade: 25,
  urgencia: 25,
  tendencia: 25,
  dorCliente: 25,
};

/** AC-3: valida que os 4 pesos somam exatamente 100% — bloqueia salvar caso contrário. */
export function validarPesosGutd(pesos: PesosGutd): PesosGutd {
  const soma = pesos.gravidade + pesos.urgencia + pesos.tendencia + pesos.dorCliente;
  if (soma !== 100) {
    throw new RangeError(`Pesos GUTD devem somar 100% (soma atual: ${soma}%).`);
  }
  for (const [nome, valor] of Object.entries(pesos)) {
    if (!Number.isInteger(valor) || valor < 0 || valor > 100) {
      throw new RangeError(`Peso '${nome}' deve ser inteiro entre 0 e 100 (recebido: ${valor}).`);
    }
  }
  return pesos;
}

/**
 * AC-2: `prioridade = wG·G + wU·U + wT·T + wD·D` (pesos em fração de 100, resultado na mesma
 * escala 1-5 dos fatores — é uma média ponderada, não um produto).
 * AC-4: "D ausente ⇒ não penaliza nem infla artificialmente" — em vez de tratar D como 0 (que
 * PENALIZARIA, derrubando a média) ou ignorar o peso de D (que INFLARIA os outros), redistribui o
 * peso de D proporcionalmente entre G/U/T: o item passa a ser pontuado exatamente como se o
 * sistema ainda fosse GUT puro, sem D — retrocompat real com itens antigos (AC-4).
 */
export function calcularScoreGutd(
  gravidade: number,
  urgencia: number,
  tendencia: number,
  dorCliente: number | null,
  pesos: PesosGutd,
): number {
  validarFator("gravidade", gravidade);
  validarFator("urgencia", urgencia);
  validarFator("tendencia", tendencia);

  if (dorCliente === null) {
    const somaPesosGut = pesos.gravidade + pesos.urgencia + pesos.tendencia;
    if (somaPesosGut === 0) return 0; // todo peso em D e D ausente — nada pra calcular
    return (
      (pesos.gravidade * gravidade + pesos.urgencia * urgencia + pesos.tendencia * tendencia) /
      somaPesosGut
    );
  }

  validarFator("dorCliente", dorCliente);
  return (
    (pesos.gravidade * gravidade +
      pesos.urgencia * urgencia +
      pesos.tendencia * tendencia +
      pesos.dorCliente * dorCliente) /
    100
  );
}

/** Faixas na escala 1-5 (score GUTD é uma média dos fatores, não mais um produto 1-125) — quartis
 * do intervalo [1,5]: crítica no top 12,5%, alta no próximo quartil, etc. */
export function classificarPrioridadeGutd(score: number): PrioridadeBacklog {
  if (score >= 4.5) return "critica";
  if (score >= 3.5) return "alta";
  if (score >= 2.5) return "media";
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
