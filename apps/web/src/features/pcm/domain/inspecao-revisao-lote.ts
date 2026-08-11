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
  /** Quarto fator do GUTd (E01-S82). `null` é legítimo e não penaliza — `calcularScoreGutd`
   * redistribui o peso de D entre G/U/T quando ele falta. */
  dorCliente: number | null;
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
  // Numerado a partir de 1: o índice é o que amarra a resposta da IA de volta ao item. Sem ele,
  // a correlação dependia de a IA devolver exatamente N itens na mesma ordem — e como o endpoint
  // reusado era de EXTRAÇÃO, ela devolvia quantos achasse, derrubando tudo no fallback 3/3/3.
  return itens
    .map((item, i) => `${i + 1}. Local: ${item.localizacao ?? ""}\nRelato: ${item.descricao}`)
    .join("\n\n---\n\n");
}

const FALLBACK_GUT_ESFORCO: ClassificacaoGutEsforco = {
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
  dorCliente: 3,
  esforcoHoras: 0,
  justificativaEsforco: null,
  citacaoNormativa: null,
};

/** Classificação vinda da IA já com o índice (1-based) do item ao qual pertence. */
export interface ClassificacaoIndexada extends ClassificacaoGutEsforco {
  indice: number;
}

/** AC-4: pareia pelo ÍNDICE que a IA devolve, não pela posição no array.
 *
 * Isso muda o comportamento de degradação de forma importante: antes, se a IA devolvesse 9
 * classificações para 10 itens, TODOS os 10 caíam no fallback 3/3/3. Agora os 9 que vieram
 * mantêm a nota real e só o que faltou usa o fallback — a IA é copiloto, e perder o trabalho dela
 * inteiro por causa de um item é pior do que sinalizar a lacuna.
 *
 * `correlacionou` passa a significar "todos os itens receberam nota da IA". */
export function parearClassificacaoComItens(
  itens: readonly ItemParaClassificar[],
  classificados: readonly ClassificacaoIndexada[],
): { itens: ItemClassificado[]; correlacionou: boolean } {
  const porIndice = new Map<number, ClassificacaoIndexada>();
  for (const classificacao of classificados) {
    // Índice fora da faixa é resposta inválida da IA — descarta em vez de casar com o item errado.
    if (classificacao.indice >= 1 && classificacao.indice <= itens.length) {
      porIndice.set(classificacao.indice, classificacao);
    }
  }

  let faltou = false;
  const resultado = itens.map((item, index) => {
    const fonte = porIndice.get(index + 1);
    if (!fonte) faltou = true;
    const gut = fonte ?? FALLBACK_GUT_ESFORCO;
    return {
      itemId: item.id,
      gravidade: gut.gravidade,
      urgencia: gut.urgencia,
      tendencia: gut.tendencia,
      dorCliente: gut.dorCliente,
      esforcoHoras: gut.esforcoHoras,
      justificativaEsforco: gut.justificativaEsforco,
      citacaoNormativa: gut.citacaoNormativa,
    };
  });

  return { correlacionou: !faltou, itens: resultado };
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
