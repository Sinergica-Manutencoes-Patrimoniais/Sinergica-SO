// _shared/marketing/meta-ads.ts — porta de LEITURA da Meta Ads (E06-S01, ADR-1699).
//
// ESTA PORTA NÃO TEM MÉTODO DE ESCRITA, E NÃO VAI TER. Criar, pausar, editar campanha, conjunto,
// anúncio, orçamento ou criativo está fora de escopo (FR-017 da spec). Um método de escrita não
// usado é um convite a ser usado; por isso o escopo do token pedido é `ads_read`, não
// `ads_management` — a decisão é operacional, não só de código.
//
// Duas implementações: `criarMetaAdsHttp` (fala com a Graph API, pronta, ainda não exercitada em
// produção porque a Meta não está conectada) e `criarMetaAdsFixture` (determinística). Quem
// escolhe é a Edge Function, pela presença do token no cofre — e a origem viaja na resposta.

export interface CampanhaLida {
  readonly campanhaExternaId: string;
  readonly nome: string;
  readonly objetivo: string | null;
  readonly situacao: string | null;
}

export interface ConjuntoLido {
  readonly conjuntoExternoId: string;
  readonly campanhaExternaId: string;
  readonly nome: string;
  readonly situacao: string | null;
}

export interface AnuncioLido {
  readonly anuncioExternoId: string;
  readonly conjuntoExternoId: string;
  readonly nome: string;
  readonly situacao: string | null;
}

export interface HierarquiaLida {
  readonly campanhas: readonly CampanhaLida[];
  readonly conjuntos: readonly ConjuntoLido[];
  readonly anuncios: readonly AnuncioLido[];
}

export interface NumeroDoDia {
  readonly anuncioExternoId: string;
  readonly dia: string; // AAAA-MM-DD
  readonly gastoCentavos: number;
  readonly alcance: number;
  readonly impressoes: number;
  readonly cliques: number;
  readonly leads: number;
}

export interface MetaAdsPort {
  hierarquia(contaExternaId: string): Promise<HierarquiaLida>;
  numerosDiarios(contaExternaId: string, de: string, ate: string): Promise<NumeroDoDia[]>;
}

export class FalhaMetaAds extends Error {
  constructor(readonly codigo: string) {
    // Só o código. O corpo da resposta da Meta pode conter o token refletido de volta, e a
    // mensagem de erro acaba em log e em `marketing.sincronizacoes.detalhe`.
    super(codigo);
    this.name = "FalhaMetaAds";
  }
}

// ─── conversões ──────────────────────────────────────────────────────────────

/** A Meta manda `spend` como string decimal na moeda da conta ("123.45"). Centavos inteiros é o
 * que o schema guarda (ADR-0001); converter uma vez, na borda, é o que impede ponto flutuante de
 * circular pelo resto do sistema. */
export function paraCentavos(valor: unknown): number {
  const numero = typeof valor === "string" ? Number(valor) : typeof valor === "number" ? valor : 0;
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.round(numero * 100);
}

function inteiro(valor: unknown): number {
  const numero = typeof valor === "string" ? Number(valor) : typeof valor === "number" ? valor : 0;
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : 0;
}

/** Tipos de ação que a Meta usa para "lead". Mais de um porque a conta pode estar medindo por
 * formulário instantâneo, por conversa ou por pixel do site, e as três contam como lead para
 * quem olha o relatório. */
export const ACOES_DE_LEAD = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

export function somarLeads(acoes: unknown): number {
  if (!Array.isArray(acoes)) return 0;
  let total = 0;
  for (const acao of acoes) {
    const item = acao as { action_type?: unknown; value?: unknown };
    if (typeof item.action_type === "string" && ACOES_DE_LEAD.has(item.action_type)) {
      total += inteiro(item.value);
    }
  }
  return total;
}

// ─── implementação HTTP ──────────────────────────────────────────────────────

const VERSAO_PADRAO = "v22.0";

// Sem este filtro, anúncio arquivado ou excluído some da resposta e o gasto do relatório fica
// MENOR que o do Gerenciador de Anúncios — o tipo de divergência que faz a equipe parar de
// confiar na tela inteira.
const SITUACOES = [
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "DELETED",
  "CAMPAIGN_PAUSED",
  "ADSET_PAUSED",
  "PENDING_REVIEW",
  "DISAPPROVED",
  "IN_PROCESS",
  "WITH_ISSUES",
];

const CAMPOS_DOS_ANUNCIOS =
  "id,name,effective_status,adset{id,name,effective_status},campaign{id,name,effective_status,objective}";

const CAMPOS_DOS_NUMEROS =
  "ad_id,spend,impressions,reach,inline_link_clicks,actions";

export function criarMetaAdsHttp(token: string, versao = VERSAO_PADRAO): MetaAdsPort {
  async function buscar(caminho: string, parametros: Record<string, string>) {
    const url = new URL(`https://graph.facebook.com/${versao}/${caminho}`);
    for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor);

    let resposta: Response;
    try {
      resposta = await fetch(url, {
        // Token no cabeçalho, NUNCA na URL: a URL entra em log de proxy, em telemetria e em
        // mensagem de erro. `redirect: "error"` impede que um 3xx leve o cabeçalho para outro host.
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(9_000),
      });
    } catch {
      throw new FalhaMetaAds("meta_indisponivel");
    }

    if (!resposta.ok) {
      if (resposta.status === 401) throw new FalhaMetaAds("credencial_invalida");
      if (resposta.status === 403) throw new FalhaMetaAds("sem_permissao_de_leitura");
      if (resposta.status === 429) throw new FalhaMetaAds("limite_atingido");
      if (resposta.status >= 400 && resposta.status < 500) {
        throw new FalhaMetaAds("requisicao_recusada");
      }
      throw new FalhaMetaAds("meta_indisponivel");
    }

    const corpo = (await resposta.json().catch(() => ({}))) as { data?: unknown };
    return Array.isArray(corpo.data) ? corpo.data : [];
  }

  return {
    async hierarquia(contaExternaId: string): Promise<HierarquiaLida> {
      const linhas = await buscar(`act_${contaExternaId}/ads`, {
        fields: CAMPOS_DOS_ANUNCIOS,
        limit: "200",
        filtering: JSON.stringify([
          { field: "ad.effective_status", operator: "IN", value: SITUACOES },
        ]),
      });

      const campanhas = new Map<string, CampanhaLida>();
      const conjuntos = new Map<string, ConjuntoLido>();
      const anuncios: AnuncioLido[] = [];

      for (const bruto of linhas) {
        const linha = bruto as {
          id?: string;
          name?: string;
          effective_status?: string;
          adset?: { id?: string; name?: string; effective_status?: string };
          campaign?: { id?: string; name?: string; effective_status?: string; objective?: string };
        };
        if (!linha.id || !linha.adset?.id || !linha.campaign?.id) continue;

        campanhas.set(linha.campaign.id, {
          campanhaExternaId: linha.campaign.id,
          nome: linha.campaign.name ?? linha.campaign.id,
          objetivo: linha.campaign.objective ?? null,
          situacao: linha.campaign.effective_status ?? null,
        });
        conjuntos.set(linha.adset.id, {
          conjuntoExternoId: linha.adset.id,
          campanhaExternaId: linha.campaign.id,
          nome: linha.adset.name ?? linha.adset.id,
          situacao: linha.adset.effective_status ?? null,
        });
        anuncios.push({
          anuncioExternoId: linha.id,
          conjuntoExternoId: linha.adset.id,
          nome: linha.name ?? linha.id,
          situacao: linha.effective_status ?? null,
        });
      }

      return {
        campanhas: [...campanhas.values()],
        conjuntos: [...conjuntos.values()],
        anuncios,
      };
    },

    async numerosDiarios(contaExternaId, de, ate): Promise<NumeroDoDia[]> {
      const linhas = await buscar(`act_${contaExternaId}/insights`, {
        level: "ad",
        time_increment: "1",
        time_range: JSON.stringify({ since: de, until: ate }),
        fields: CAMPOS_DOS_NUMEROS,
        limit: "500",
        filtering: JSON.stringify([
          { field: "ad.effective_status", operator: "IN", value: SITUACOES },
        ]),
      });

      const numeros: NumeroDoDia[] = [];
      for (const bruto of linhas) {
        const linha = bruto as Record<string, unknown>;
        const anuncioExternoId = typeof linha.ad_id === "string" ? linha.ad_id : null;
        const dia = typeof linha.date_start === "string" ? linha.date_start : null;
        if (!anuncioExternoId || !dia) continue;
        numeros.push({
          anuncioExternoId,
          dia,
          gastoCentavos: paraCentavos(linha.spend),
          alcance: inteiro(linha.reach),
          impressoes: inteiro(linha.impressions),
          cliques: inteiro(linha.inline_link_clicks),
          leads: somarLeads(linha.actions),
        });
      }
      return numeros;
    },
  };
}

// ─── implementação de demonstração ───────────────────────────────────────────

interface FixtureBruta {
  readonly campanhas: readonly CampanhaLida[];
  readonly conjuntos: readonly ConjuntoLido[];
  readonly anuncios: readonly AnuncioLido[];
  readonly numerosPorAnuncio: Readonly<
    Record<
      string,
      { gastoCentavos: number; alcance: number; impressoes: number; cliques: number; leads: number }
    >
  >;
}

function diasEntre(de: string, ate: string): string[] {
  const dias: string[] = [];
  const atual = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  while (atual <= fim) {
    dias.push(atual.toISOString().slice(0, 10));
    atual.setUTCDate(atual.getUTCDate() + 1);
  }
  return dias;
}

/** Determinística: o mesmo dia produz sempre o mesmo número. Nada de `Math.random()`, senão
 * rodar a sincronização duas vezes "corrigiria" valores que nunca mudaram e a prova de
 * idempotência (AC-9) viraria ruído. */
function variacaoDoDia(anuncioExternoId: string, dia: string): number {
  let soma = 0;
  const semente = `${anuncioExternoId}${dia}`;
  for (let i = 0; i < semente.length; i += 1) soma = (soma * 31 + semente.charCodeAt(i)) % 1000;
  return 0.6 + (soma % 80) / 100; // entre 0,60 e 1,39
}

export function criarMetaAdsFixture(fixture: FixtureBruta): MetaAdsPort {
  return {
    hierarquia(): Promise<HierarquiaLida> {
      return Promise.resolve({
        campanhas: fixture.campanhas,
        conjuntos: fixture.conjuntos,
        anuncios: fixture.anuncios,
      });
    },

    numerosDiarios(_contaExternaId, de, ate): Promise<NumeroDoDia[]> {
      const numeros: NumeroDoDia[] = [];
      for (const dia of diasEntre(de, ate)) {
        for (const anuncio of fixture.anuncios) {
          const base = fixture.numerosPorAnuncio[anuncio.anuncioExternoId];
          if (!base) continue;
          const fator = variacaoDoDia(anuncio.anuncioExternoId, dia);
          numeros.push({
            anuncioExternoId: anuncio.anuncioExternoId,
            dia,
            gastoCentavos: Math.round(base.gastoCentavos * fator),
            alcance: Math.round(base.alcance * fator),
            impressoes: Math.round(base.impressoes * fator),
            cliques: Math.round(base.cliques * fator),
            leads: Math.round(base.leads * fator),
          });
        }
      }
      return Promise.resolve(numeros);
    },
  };
}
