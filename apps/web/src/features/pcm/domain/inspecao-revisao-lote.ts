// domain/inspecao-revisao-lote.ts — E01-S143. Fabrício seleciona itens já existentes de uma
// inspeção pra virar backlog; a IA (mesmo motor de classificação da E01-S105, endpoint reusado sem
// mudança) calcula GUT/esforço/embasamento normativo por item. Puro/testável: monta o texto que vai
// pra IA e pareia a resposta de volta com os itens originais por índice — mesma estratégia de
// correlação já aceita no import de planilha (E01-S105), aqui sobre itens com `id` estável.

export interface ItemParaClassificar {
  id: string;
  localizacao: string | null;
  descricao: string;
}

export interface ClassificacaoGutEsforco {
  gravidade: number;
  urgencia: number;
  tendencia: number;
  esforcoHoras: number;
  justificativaEsforco: string | null;
  citacaoNormativa: string | null;
}

export interface ItemClassificado extends ClassificacaoGutEsforco {
  itemId: string;
}

/** Mesmo formato de bloco usado no parser de planilha (`inspecao-excel.ts`) — a IA já foi treinada
 * (prompt v1, E01-S105) nesse formato de entrada. */
export function montarTextoParaClassificacao(itens: readonly ItemParaClassificar[]): string {
  return itens
    .map((item) => `Local: ${item.localizacao ?? ""}\nRelato: ${item.descricao}`)
    .join("\n\n---\n\n");
}

const FALLBACK_GUT_ESFORCO: ClassificacaoGutEsforco = {
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
  esforcoHoras: 0,
  justificativaEsforco: null,
  citacaoNormativa: null,
};

/** AC-4: pareia por índice — mesma contagem esperada. Contagem diferente (falha de correlação da
 * IA) cai pro fallback 3/3/3 em TODOS os itens, sinalizando `correlacionou: false` pra UI avisar e
 * a revisão editável seguir mesmo assim (IA é copiloto, nunca bloqueia). */
export function parearClassificacaoComItens(
  itens: readonly ItemParaClassificar[],
  classificados: readonly ClassificacaoGutEsforco[],
): { itens: ItemClassificado[]; correlacionou: boolean } {
  const correlacionou = classificados.length === itens.length;
  return {
    correlacionou,
    itens: itens.map((item, index) => {
      const fonte = correlacionou ? classificados[index] : undefined;
      const gut = fonte ?? FALLBACK_GUT_ESFORCO;
      return {
        itemId: item.id,
        gravidade: gut.gravidade,
        urgencia: gut.urgencia,
        tendencia: gut.tendencia,
        esforcoHoras: gut.esforcoHoras,
        justificativaEsforco: gut.justificativaEsforco,
        citacaoNormativa: gut.citacaoNormativa,
      };
    }),
  };
}

/** AC-5: texto formatado embutido na `observacao` da OS — esforço/embasamento normativo não têm
 * coluna própria em `pcm.ordens_servico` (decisão de escopo, ver spec.md), ficam legíveis aqui. */
export function formatarObservacaoBacklog(classificacao: ClassificacaoGutEsforco): string {
  const linhas = [
    `Esforço estimado: ${classificacao.esforcoHoras}h`,
    classificacao.justificativaEsforco
      ? `Justificativa: ${classificacao.justificativaEsforco}`
      : null,
    classificacao.citacaoNormativa
      ? `Embasamento normativo: ${classificacao.citacaoNormativa}`
      : null,
  ].filter((linha): linha is string => Boolean(linha));
  return linhas.join("\n");
}
