/** Indicadores das campanhas da Meta (E06-S01, AC-1 a AC-5).
 *
 * Regra pura, sem I/O e sem framework. Porte da lógica madura do produto irmão da casa
 * (TriviAtende), adaptada ao schema daqui: lá o dinheiro é `numeric`, aqui é **centavo inteiro**
 * (ADR-0001); lá a hierarquia tem conta no topo, aqui a tela já é de uma conta só.
 *
 * DOIS PRINCÍPIOS ATRAVESSAM TUDO, e são a diferença entre um relatório que mente e um que não:
 *
 * 1. **Zero confirmado ≠ indisponível.** Indicador sem base de cálculo é `null`, e a tela mostra
 *    `—`. "Custo por lead R$ 0,00" num anúncio que gastou e não gerou lead é uma afirmação falsa
 *    que leva a decidir errado. Daí `temNumeros` existir separado de `gastoCentavos === 0`.
 * 2. **Alcance não é somável.** Alcance é gente distinta; somar dias conta a mesma pessoa de
 *    novo. A soma existe aqui porque é o melhor que o grão diário permite, mas a tela a exibe
 *    rotulada como "Alcance (soma diária)" — nunca como pessoas distintas do período. Ver
 *    `research.md` D4. É por isso que AC-2 cobra igualdade entre níveis só para gasto,
 *    impressões, cliques e leads. */

/** Uma linha crua da RPC `marketing.fn_metricas_periodo`: um anúncio com as somas do período. */
export interface LinhaDeAnuncio {
  readonly campanhaId: string;
  readonly campanhaNome: string;
  readonly campanhaSituacao: string | null;
  readonly conjuntoId: string;
  readonly conjuntoNome: string;
  readonly anuncioId: string;
  readonly anuncioNome: string;
  readonly anuncioSituacao: string | null;
  /** `false` = a Meta ainda não mandou números deste anúncio no período. Diferente de gastar 0. */
  readonly temNumeros: boolean;
  readonly gastoCentavos: number;
  readonly alcance: number;
  readonly impressoes: number;
  readonly cliques: number;
  readonly leads: number;
}

export type Somas = Pick<
  LinhaDeAnuncio,
  "temNumeros" | "gastoCentavos" | "alcance" | "impressoes" | "cliques" | "leads"
>;

export interface Indicadores extends Somas {
  /** Custo por mil impressões, em centavos. */
  readonly cpmCentavos: number | null;
  /** Cliques ÷ impressões, como fração (0,0123 = 1,23%). */
  readonly ctr: number | null;
  readonly cpcCentavos: number | null;
  readonly custoPorLeadCentavos: number | null;
}

export const SOMAS_ZERADAS: Somas = {
  temNumeros: false,
  gastoCentavos: 0,
  alcance: 0,
  impressoes: 0,
  cliques: 0,
  leads: 0,
};

/** Taxa: só exige denominador > 0. Numerador zero é `0` — resultado legítimo, não ausência. */
export function dividir(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

/** Custo: exige gasto > 0 **e** quantidade > 0. Sem gasto, o custo unitário é desconhecido, não
 * zero; sem quantidade, é uma divisão por zero disfarçada. */
export function custo(gastoCentavos: number, quantidade: number): number | null {
  return gastoCentavos > 0 && quantidade > 0 ? gastoCentavos / quantidade : null;
}

export function somar(linhas: readonly Somas[]): Somas {
  return linhas.reduce<Somas>(
    (total, linha) => ({
      temNumeros: total.temNumeros || linha.temNumeros,
      gastoCentavos: total.gastoCentavos + linha.gastoCentavos,
      alcance: total.alcance + linha.alcance,
      impressoes: total.impressoes + linha.impressoes,
      cliques: total.cliques + linha.cliques,
      leads: total.leads + linha.leads,
    }),
    SOMAS_ZERADAS,
  );
}

export function indicadores(somas: Somas): Indicadores {
  return {
    ...somas,
    cpmCentavos:
      somas.gastoCentavos > 0 && somas.impressoes > 0
        ? (somas.gastoCentavos / somas.impressoes) * 1000
        : null,
    ctr: dividir(somas.cliques, somas.impressoes),
    cpcCentavos: custo(somas.gastoCentavos, somas.cliques),
    custoPorLeadCentavos: custo(somas.gastoCentavos, somas.leads), // AC-5
  };
}

// ─── árvore campanha → conjunto → anúncio ────────────────────────────────────

export interface NoDeAnuncio {
  readonly tipo: "anuncio";
  readonly id: string;
  readonly nome: string;
  readonly situacao: string | null;
  readonly indicadores: Indicadores;
}

export interface NoDeConjunto {
  readonly tipo: "conjunto";
  readonly id: string;
  readonly nome: string;
  readonly indicadores: Indicadores;
  readonly anuncios: readonly NoDeAnuncio[];
}

export interface NoDeCampanha {
  readonly tipo: "campanha";
  readonly id: string;
  readonly nome: string;
  readonly situacao: string | null;
  readonly indicadores: Indicadores;
  readonly conjuntos: readonly NoDeConjunto[];
}

export interface Relatorio {
  readonly total: Indicadores;
  readonly campanhas: readonly NoDeCampanha[];
}

/** Monta a árvore e calcula cada nó como `indicadores(somar(filhos))` — é isso que faz AC-2 ser
 * verdade por construção, e não por uma conferência manual que alguém esquece de refazer.
 * `Map` preserva a ordem de chegada; a RPC já devolve ordenado por nome. */
export function arvoreDoRelatorio(linhas: readonly LinhaDeAnuncio[]): Relatorio {
  const porCampanha = new Map<string, LinhaDeAnuncio[]>();
  for (const linha of linhas) {
    const atual = porCampanha.get(linha.campanhaId);
    if (atual) atual.push(linha);
    else porCampanha.set(linha.campanhaId, [linha]);
  }

  const campanhas: NoDeCampanha[] = [];
  for (const [campanhaId, daCampanha] of porCampanha) {
    const porConjunto = new Map<string, LinhaDeAnuncio[]>();
    for (const linha of daCampanha) {
      const atual = porConjunto.get(linha.conjuntoId);
      if (atual) atual.push(linha);
      else porConjunto.set(linha.conjuntoId, [linha]);
    }

    const conjuntos: NoDeConjunto[] = [];
    for (const [conjuntoId, doConjunto] of porConjunto) {
      const anuncios: NoDeAnuncio[] = doConjunto.map((linha) => ({
        tipo: "anuncio",
        id: linha.anuncioId,
        nome: linha.anuncioNome,
        situacao: linha.anuncioSituacao,
        indicadores: indicadores(linha),
      }));
      conjuntos.push({
        tipo: "conjunto",
        id: conjuntoId,
        nome: doConjunto[0]?.conjuntoNome ?? conjuntoId,
        indicadores: indicadores(somar(anuncios.map((a) => a.indicadores))),
        anuncios,
      });
    }

    campanhas.push({
      tipo: "campanha",
      id: campanhaId,
      nome: daCampanha[0]?.campanhaNome ?? campanhaId,
      situacao: daCampanha[0]?.campanhaSituacao ?? null,
      indicadores: indicadores(somar(conjuntos.map((c) => c.indicadores))),
      conjuntos,
    });
  }

  return { total: indicadores(somar(campanhas.map((c) => c.indicadores))), campanhas };
}

// ─── ordenação ───────────────────────────────────────────────────────────────

export type IndicadorOrdenavel = keyof Pick<
  Indicadores,
  | "gastoCentavos"
  | "impressoes"
  | "cliques"
  | "leads"
  | "ctr"
  | "cpcCentavos"
  | "cpmCentavos"
  | "custoPorLeadCentavos"
>;

/** Indicadores em que menor é melhor — quem ordena "do melhor para o pior" precisa saber. */
export const MENOR_E_MELHOR: ReadonlySet<IndicadorOrdenavel> = new Set([
  "cpcCentavos",
  "cpmCentavos",
  "custoPorLeadCentavos",
]);

/** `null` ("sem base de cálculo") vai sempre para o fim, nos **dois** sentidos: ele não é nem o
 * melhor nem o pior, é desconhecido, e deixá-lo flutuar no meio do ranking engana a leitura.
 * Desempate por nome em pt-BR para a ordem ser estável entre recarregamentos. */
export function ordenarPor<T extends { nome: string; indicadores: Indicadores }>(
  itens: readonly T[],
  indicador: IndicadorOrdenavel,
  sentido: "asc" | "desc" = "desc",
): T[] {
  return [...itens].sort((a, b) => {
    const va = a.indicadores[indicador];
    const vb = b.indicadores[indicador];
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, "pt-BR");
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va === vb) return a.nome.localeCompare(b.nome, "pt-BR");
    return sentido === "asc" ? va - vb : vb - va;
  });
}

/** `true` quando não há nada que mereça uma tabela — é o estado de vazio nomeado do AC-4, e não
 * "a lista veio com zeros". */
export function semVeiculacao(relatorio: Relatorio): boolean {
  return (
    relatorio.campanhas.length === 0 ||
    (!relatorio.total.temNumeros &&
      relatorio.total.gastoCentavos === 0 &&
      relatorio.total.impressoes === 0 &&
      relatorio.total.leads === 0)
  );
}

// ─── achatamento para a tabela ───────────────────────────────────────────────

export interface LinhaDaTabela {
  /** Único na tabela inteira: o mesmo id pode aparecer em níveis diferentes no futuro. */
  readonly chave: string;
  readonly nivel: 0 | 1 | 2;
  readonly id: string;
  readonly nome: string;
  readonly indicadores: Indicadores;
  readonly temFilhos: boolean;
  readonly aberto: boolean;
}

/** Transforma a árvore nas linhas que a tabela mostra agora, dado o conjunto de nós abertos.
 * A hierarquia é do domínio; o componente só desenha o recuo. Função pura, logo o
 * comportamento de abrir/fechar é testável sem montar React. */
export function linhasVisiveis(
  relatorio: Relatorio,
  abertos: ReadonlySet<string>,
): LinhaDaTabela[] {
  const linhas: LinhaDaTabela[] = [];
  for (const campanha of relatorio.campanhas) {
    const campanhaAberta = abertos.has(campanha.id);
    linhas.push({
      chave: `campanha:${campanha.id}`,
      nivel: 0,
      id: campanha.id,
      nome: campanha.nome,
      indicadores: campanha.indicadores,
      temFilhos: campanha.conjuntos.length > 0,
      aberto: campanhaAberta,
    });
    if (!campanhaAberta) continue;

    for (const conjunto of campanha.conjuntos) {
      const conjuntoAberto = abertos.has(conjunto.id);
      linhas.push({
        chave: `conjunto:${conjunto.id}`,
        nivel: 1,
        id: conjunto.id,
        nome: conjunto.nome,
        indicadores: conjunto.indicadores,
        temFilhos: conjunto.anuncios.length > 0,
        aberto: conjuntoAberto,
      });
      if (!conjuntoAberto) continue;

      for (const anuncio of conjunto.anuncios) {
        linhas.push({
          chave: `anuncio:${anuncio.id}`,
          nivel: 2,
          id: anuncio.id,
          nome: anuncio.nome,
          indicadores: anuncio.indicadores,
          temFilhos: false,
          aberto: false,
        });
      }
    }
  }
  return linhas;
}
