/** Importação de itens do Assessment do PCM (E01-S90) para a composição da proposta (E03-S05).
 * Pura — sem I/O. Decide QUAIS itens do Assessment valem virar item de composição (AC-4) e como
 * formatar a descrição; quem chama decide tipo/nível/material (application, meeting point com
 * `proposta-gateway.ts` da S04). Nunca decide se acrescenta ou sobrescreve — isso é responsabilidade
 * de quem chama (AC-5: sempre concatena com o que já existe, nunca substitui). */

export type ResultadoAssessmentItem =
  | "conforme"
  | "nao_conforme"
  | "atencao"
  | "nao_avaliado"
  | "nao_aplicavel";

export interface ItemAssessmentParaImportar {
  sistema: string;
  localizacao: string | null;
  descricao: string;
  resultado: ResultadoAssessmentItem;
  recomendacao: string | null;
}

export interface ItemComposicaoImportado {
  descricao: string;
  quantidade: number;
  custoUnitarioCentavos: number;
}

export interface ResultadoImportacao {
  itensImportados: ItemComposicaoImportado[];
  quantidadeImportada: number;
  quantidadeIgnorada: number;
}

// AC-4 fala em importar "os sistemas/itens encontrados" — achado é o que pede intervenção. Item
// conforme/não avaliado/não aplicável não gera trabalho, então não vira linha de composição
// sozinho (o comercial ainda pode digitar manualmente se quiser cobrar algo sobre eles).
const RESULTADOS_IMPORTAVEIS: ReadonlySet<ResultadoAssessmentItem> = new Set([
  "nao_conforme",
  "atencao",
]);

export function itemAssessmentEhImportavel(resultado: ResultadoAssessmentItem): boolean {
  return RESULTADOS_IMPORTAVEIS.has(resultado);
}

export function formatarDescricaoItemImportado(item: ItemAssessmentParaImportar): string {
  const local = item.localizacao ? ` (${item.localizacao})` : "";
  const base = `${item.descricao}${local}`;
  return item.recomendacao ? `${base} — ${item.recomendacao}` : base;
}

/** AC-4/AC-5: converte os itens importáveis do Assessment em itens de composição prontos para
 * serem ACRESCENTADOS aos existentes (quem chama concatena — este função nunca vê os itens que já
 * estavam na proposta). Custo unitário nasce em 0 — o Assessment não precifica, o comercial edita
 * depois (mesma regra de "sempre editável" do AC-4). Levantamento sem item importável: retorna
 * lista vazia e as contagens dizem o motivo — não é erro (caso de borda da spec). */
export function importarItensDoAssessment(
  itensAssessment: readonly ItemAssessmentParaImportar[],
): ResultadoImportacao {
  const importaveis = itensAssessment.filter((item) => itemAssessmentEhImportavel(item.resultado));
  const itensImportados = importaveis.map((item) => ({
    descricao: formatarDescricaoItemImportado(item),
    quantidade: 1,
    custoUnitarioCentavos: 0,
  }));
  return {
    itensImportados,
    quantidadeImportada: itensImportados.length,
    quantidadeIgnorada: itensAssessment.length - itensImportados.length,
  };
}
