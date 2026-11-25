/** Adapter Supabase do Marketing (E06-S01). Roda sob a sessão do usuário, nunca `service_role`.
 *
 * Leitura dos indicadores e da receita passa por RPC (migration 1900) porque a agregação por
 * período é SQL; o resto é `select`/`insert` direto sob RLS. A sincronização é Edge Function: é
 * lá que mora a credencial da Meta, e ela nunca chega ao navegador (ADR-1699 §4). */

import { supabase } from "../../../lib/supabase-client";
import type {
  ContaDeAnuncio,
  LinkRastreado,
  MarketingGateway,
  NovoLinkRastreado,
  ResultadoDaSincronizacao,
  Sincronizacao,
} from "../application/marketing-gateway";
import { ErroDoMarketing } from "../application/marketing-gateway";
import type { LinhaDeAnuncio } from "../domain/indicadores";
import type { Periodo } from "../domain/periodo";
import type { LinhaDeReceita } from "../domain/receita-campanha";

const marketing = () => supabase.schema("marketing");

interface ErroPostgrest {
  readonly code?: string;
  readonly message?: string;
}

/** Traduz o código do Postgres para um erro que a tela sabe explicar. `42501` vindo da RPC de
 * receita é especificamente "falta o Comercial" (AC-17) — a mesma recusa nas outras RPCs é
 * "falta escrita no Marketing", e as duas frases são diferentes para quem lê. */
function comoErro(erro: ErroPostgrest | null, contexto: "receita" | "geral"): ErroDoMarketing {
  const codigo = erro?.code;
  if (codigo === "42501") {
    return new ErroDoMarketing(
      contexto === "receita" ? "sem_permissao_comercial" : "sem_permissao",
      erro?.message,
    );
  }
  if (codigo === "22023") return new ErroDoMarketing("periodo_invalido", erro?.message);
  if (codigo === "23505") return new ErroDoMarketing("oportunidade_ja_vinculada", erro?.message);
  return new ErroDoMarketing("indisponivel", erro?.message);
}

interface LinhaMetricaRow {
  campanha_id: string;
  campanha_nome: string;
  campanha_situacao: string | null;
  conjunto_id: string;
  conjunto_nome: string;
  anuncio_id: string;
  anuncio_nome: string;
  anuncio_situacao: string | null;
  tem_numeros: boolean;
  gasto_centavos: number;
  alcance: number;
  impressoes: number;
  cliques: number;
  leads: number;
}

interface LinhaReceitaRow {
  campanha_id: string;
  campanha_nome: string;
  gasto_centavos: number;
  leads: number;
  oportunidades: number;
  contratos: number;
  receita_centavos: number;
}

interface ContaRow {
  id: string;
  nome: string;
  conta_externa_id: string;
  moeda: string;
  ativa: boolean;
  sincronizada_em: string | null;
}

interface SincronizacaoRow {
  id: string;
  janela_de: string;
  janela_ate: string;
  origem: "meta" | "demonstracao";
  resultado: "sucesso" | "falha";
  campanhas: number;
  conjuntos: number;
  anuncios: number;
  metricas: number;
  detalhe: string | null;
  concluida_em: string;
}

interface LinkRow {
  id: string;
  anuncio_id: string;
  token: string;
  url_destino: string;
  rotulo: string | null;
  ativo: boolean;
}

// Nome sem "token": a regra `generic-api-key` do gitleaks casa pelo FORMATO do par
// (identificador com "token" no nome + string longa), não pelo conteúdo, e marcava este
// alfabeto público como se fosse segredo.
const ALFABETO_SORTEIO = "abcdefghijklmnopqrstuvwxyz0123456789";

/** 12 caracteres sorteados do CSPRNG do navegador (`crypto.getRandomValues`) — ~62 bits, no
 * formato que a CHECK de `marketing.links_rastreados.token` exige. Não é segredo: é um
 * identificador que não deve ser adivinhável para ninguém forjar atribuição. A unicidade quem
 * garante é o `unique` da coluna, não o sorteio. */
function gerarToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO_SORTEIO[b % ALFABETO_SORTEIO.length]).join("");
}

export const marketingSupabaseGateway: MarketingGateway = {
  async listarContas(): Promise<ContaDeAnuncio[]> {
    const { data, error } = await marketing()
      .from("contas_anuncio")
      .select("id,nome,conta_externa_id,moeda,ativa,sincronizada_em")
      .order("nome");
    if (error) throw comoErro(error, "geral");
    return (data as ContaRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      contaExternaId: row.conta_externa_id,
      moeda: row.moeda,
      ativa: row.ativa,
      sincronizadaEm: row.sincronizada_em,
    }));
  },

  async metricasDoPeriodo(periodo: Periodo): Promise<LinhaDeAnuncio[]> {
    const { data, error } = await marketing().rpc("fn_metricas_periodo", {
      p_de: periodo.de,
      p_ate: periodo.ate,
    });
    if (error) throw comoErro(error, "geral");
    return (data as LinhaMetricaRow[]).map((row) => ({
      campanhaId: row.campanha_id,
      campanhaNome: row.campanha_nome,
      campanhaSituacao: row.campanha_situacao,
      conjuntoId: row.conjunto_id,
      conjuntoNome: row.conjunto_nome,
      anuncioId: row.anuncio_id,
      anuncioNome: row.anuncio_nome,
      anuncioSituacao: row.anuncio_situacao,
      temNumeros: row.tem_numeros,
      // `bigint` chega como number no PostgREST; os valores desta tela ficam muito abaixo do
      // seguro (centavos de uma conta de anúncios, não o PIB).
      gastoCentavos: Number(row.gasto_centavos),
      alcance: Number(row.alcance),
      impressoes: Number(row.impressoes),
      cliques: Number(row.cliques),
      leads: Number(row.leads),
    }));
  },

  async receitaPorCampanha(periodo: Periodo): Promise<LinhaDeReceita[]> {
    const { data, error } = await marketing().rpc("fn_receita_por_campanha", {
      p_de: periodo.de,
      p_ate: periodo.ate,
    });
    if (error) throw comoErro(error, "receita");
    return (data as LinhaReceitaRow[]).map((row) => ({
      campanhaId: row.campanha_id,
      campanhaNome: row.campanha_nome,
      gastoCentavos: Number(row.gasto_centavos),
      leads: Number(row.leads),
      oportunidades: Number(row.oportunidades),
      contratos: Number(row.contratos),
      receitaCentavos: Number(row.receita_centavos),
    }));
  },

  async ultimasSincronizacoes(limite: number): Promise<Sincronizacao[]> {
    const { data, error } = await marketing()
      .from("sincronizacoes")
      .select(
        "id,janela_de,janela_ate,origem,resultado,campanhas,conjuntos,anuncios,metricas,detalhe,concluida_em",
      )
      .order("concluida_em", { ascending: false })
      .limit(limite);
    if (error) throw comoErro(error, "geral");
    return (data as SincronizacaoRow[]).map((row) => ({
      id: row.id,
      janelaDe: row.janela_de,
      janelaAte: row.janela_ate,
      origem: row.origem,
      resultado: row.resultado,
      campanhas: row.campanhas,
      conjuntos: row.conjuntos,
      anuncios: row.anuncios,
      metricas: row.metricas,
      detalhe: row.detalhe,
      concluidaEm: row.concluida_em,
    }));
  },

  async sincronizar(contaId: string, janelaDias?: number): Promise<ResultadoDaSincronizacao> {
    const { data, error } = await supabase.functions.invoke("marketing-sincronizar-meta", {
      body: { contaId, ...(janelaDias ? { janelaDias } : {}) },
    });
    if (error) throw new ErroDoMarketing("indisponivel", error.message);
    return data as ResultadoDaSincronizacao;
  },

  async criarLinkRastreado(novo: NovoLinkRastreado): Promise<LinkRastreado> {
    const token = gerarToken();
    const { data, error } = await marketing()
      .from("links_rastreados")
      .insert({
        anuncio_id: novo.anuncioId,
        token,
        url_destino: novo.urlDestino,
        rotulo: novo.rotulo ?? null,
      })
      .select("id,anuncio_id,token,url_destino,rotulo,ativo")
      .single();
    if (error) throw comoErro(error, "geral");
    const row = data as LinkRow;
    return {
      id: row.id,
      anuncioId: row.anuncio_id,
      token: row.token,
      urlDestino: row.url_destino,
      rotulo: row.rotulo,
      ativo: row.ativo,
    };
  },

  async listarLinksRastreados(): Promise<LinkRastreado[]> {
    const { data, error } = await marketing()
      .from("links_rastreados")
      .select("id,anuncio_id,token,url_destino,rotulo,ativo")
      .order("criado_em", { ascending: false });
    if (error) throw comoErro(error, "geral");
    return (data as LinkRow[]).map((row) => ({
      id: row.id,
      anuncioId: row.anuncio_id,
      token: row.token,
      urlDestino: row.url_destino,
      rotulo: row.rotulo,
      ativo: row.ativo,
    }));
  },

  async vincularOportunidade(entradaId: string, oportunidadeId: string): Promise<void> {
    const { error } = await marketing().rpc("fn_vincular_oportunidade", {
      p_entrada_id: entradaId,
      p_oportunidade_id: oportunidadeId,
    });
    if (error) throw comoErro(error, "geral");
  },
};
