/** Adapter Supabase do editor de proposta (E03-S04). Roda sob RLS.
 *
 * Criar/salvar composição/duplicar passam pelas RPCs atômicas (migration 0184) — nunca uma
 * sequência de insert/update/delete solta daqui, porque a proposta+itens+versão precisam nascer
 * ou mudar juntos (AC-2/AC-3/AC-5). Ler é `select` direto, sob RLS normal. */

import { supabase } from "../../../lib/supabase-client";
import type {
  CriarPropostaCommand,
  ForcarPrecoCommand,
  ItemCommand,
  MudarStatusCommand,
  PropostaGateway,
  SalvarComposicaoCommand,
  VersaoProposta,
  VincularAssessmentCommand,
} from "../application/proposta-gateway";
import type { Proposta, PropostaItem } from "../domain/proposta";

const PROPOSTA_COLS =
  "id,oportunidade_id,tipo,status,assessment_id,escopo,observacoes,custo_total_centavos,piso_centavos,preco_sugerido_centavos,preco_centavos,desconto_pct,valido_ate,versao_atual,created_at";
const ITEM_COLS =
  "id,proposta_id,tipo,descricao,nivel_id,material_id,quantidade,custo_unitario_centavos,total_centavos";
const VERSAO_COLS = "id,proposta_id,versao,payload,criado_em,criado_por";

interface PropostaRow {
  id: string;
  oportunidade_id: string;
  tipo: Proposta["tipo"];
  status: Proposta["status"];
  assessment_id: string | null;
  escopo: string | null;
  observacoes: string | null;
  custo_total_centavos: number;
  piso_centavos: number;
  preco_sugerido_centavos: number;
  preco_centavos: number;
  desconto_pct: number;
  valido_ate: string | null;
  versao_atual: number;
  created_at: string;
}

interface ItemRow {
  id: string;
  proposta_id: string;
  tipo: PropostaItem["tipo"];
  descricao: string;
  nivel_id: string | null;
  material_id: string | null;
  quantidade: number;
  custo_unitario_centavos: number;
  total_centavos: number;
}

function mapProposta(row: PropostaRow): Proposta {
  return {
    id: row.id,
    oportunidadeId: row.oportunidade_id,
    tipo: row.tipo,
    status: row.status,
    assessmentId: row.assessment_id,
    escopo: row.escopo,
    observacoes: row.observacoes,
    custoTotalCentavos: row.custo_total_centavos,
    pisoCentavos: row.piso_centavos,
    precoSugeridoCentavos: row.preco_sugerido_centavos,
    precoCentavos: row.preco_centavos,
    descontoPct: Number(row.desconto_pct),
    validoAte: row.valido_ate,
    versaoAtual: row.versao_atual,
    criadaEm: row.created_at,
  };
}

function mapItem(row: ItemRow): PropostaItem {
  return {
    id: row.id,
    propostaId: row.proposta_id,
    tipo: row.tipo,
    descricao: row.descricao,
    nivelId: row.nivel_id,
    materialId: row.material_id,
    quantidade: Number(row.quantidade),
    custoUnitarioCentavos: row.custo_unitario_centavos,
    totalCentavos: row.total_centavos,
  };
}

function itensParaJsonb(itens: ItemCommand[]) {
  return itens.map((item) => ({
    tipo: item.tipo,
    descricao: item.descricao,
    nivel_id: item.nivelId ?? null,
    material_id: item.materialId ?? null,
    quantidade: item.quantidade,
    custo_unitario_centavos: item.custoUnitarioCentavos,
    total_centavos: Math.round(item.quantidade * item.custoUnitarioCentavos),
  }));
}

export const supabasePropostaAdapter: PropostaGateway = {
  async listarPropostasDaOportunidade(oportunidadeId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("propostas")
      .select(PROPOSTA_COLS)
      .eq("oportunidade_id", oportunidadeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as PropostaRow[]).map(mapProposta);
  },

  async obterProposta(id: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("propostas")
      .select(PROPOSTA_COLS)
      .eq("id", id)
      .single();
    if (error) throw error;
    return mapProposta(data as PropostaRow);
  },

  async listarItens(propostaId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("proposta_itens")
      .select(ITEM_COLS)
      .eq("proposta_id", propostaId)
      .order("tipo", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ItemRow[]).map(mapItem);
  },

  async listarVersoes(propostaId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("proposta_versoes")
      .select(VERSAO_COLS)
      .eq("proposta_id", propostaId)
      .order("versao", { ascending: false });
    if (error) throw error;
    return (
      (data ?? []) as {
        id: string;
        proposta_id: string;
        versao: number;
        payload: unknown;
        criado_em: string;
        criado_por: string | null;
      }[]
    ).map((row) => ({
      id: row.id,
      propostaId: row.proposta_id,
      versao: row.versao,
      payload: row.payload,
      criadoEm: row.criado_em,
      criadoPor: row.criado_por,
    })) satisfies VersaoProposta[];
  },

  async criarProposta(input: CriarPropostaCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_criar_proposta", {
        p_oportunidade_id: input.oportunidadeId,
        p_tipo: input.tipo,
      })
      .single();
    if (error) throw error;
    return mapProposta(data as PropostaRow);
  },

  async salvarComposicao(input: SalvarComposicaoCommand) {
    // Os 4 valores de centavos já vêm calculados de `montarComandoSalvarComposicao`
    // (application/proposta.ts) — este adapter só persiste, nunca calcula.
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_salvar_composicao_proposta", {
        p_proposta_id: input.propostaId,
        p_itens: itensParaJsonb(input.itens),
        p_custo_total_centavos: input.custoTotalCentavos,
        p_piso_centavos: input.pisoCentavos,
        p_preco_sugerido_centavos: input.precoSugeridoCentavos,
        p_preco_centavos: input.precoCentavos,
        p_escopo: input.escopo ?? null,
        p_observacoes: input.observacoes ?? null,
        p_valido_ate: input.validoAte ?? null,
      })
      .single();
    if (error) throw error;
    return mapProposta(data as PropostaRow);
  },

  async mudarStatus(input: MudarStatusCommand) {
    // Trigger `fn_proposta_transicao_status` valida no banco (AC-6) — update simples.
    const { data, error } = await supabase
      .schema("comercial")
      .from("propostas")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("id", input.propostaId)
      .select(PROPOSTA_COLS)
      .single();
    if (error) throw error;
    return mapProposta(data as PropostaRow);
  },

  async vincularAssessment(input: VincularAssessmentCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .from("propostas")
      .update({ assessment_id: input.assessmentId, updated_at: new Date().toISOString() })
      .eq("id", input.propostaId)
      .select(PROPOSTA_COLS)
      .single();
    if (error) throw error;
    return mapProposta(data as PropostaRow);
  },

  async forcarPrecoAbaixoDoPiso(input: ForcarPrecoCommand) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_forcar_preco_abaixo_piso", {
        p_proposta_id: input.propostaId,
        p_preco_centavos: input.precoCentavos,
        p_motivo: input.motivo ?? null,
      })
      .single();
    if (error) throw error;
    return mapProposta(data as PropostaRow);
  },

  async duplicarProposta(propostaId: string) {
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("fn_duplicar_proposta", { p_proposta_id: propostaId })
      .single();
    if (error) throw error;
    return mapProposta(data as PropostaRow);
  },
};
