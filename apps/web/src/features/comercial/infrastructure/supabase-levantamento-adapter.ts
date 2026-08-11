/** Adapter Supabase do levantamento de pré-venda (E03-S05). Roda sob RLS.
 *
 * As três operações são RPC do schema `pcm` (não `comercial`) — o levantamento é dado do PCM
 * (`pcm.inspecoes`), o Comercial só é canal (ADR-0019 R1/R2, mesmo padrão do adapter de
 * precificação chamando RPC de `financeiro`). Nunca `select`/`insert` direto em `pcm.inspecoes`
 * ou `pcm.inspecao_itens` a partir daqui. */

import { supabase } from "../../../lib/supabase-client";
import type {
  CriarLevantamentoCommand,
  ItemLevantamento,
  LevantamentoGateway,
  LevantamentoResumo,
} from "../application/levantamento-gateway";
import type { ResultadoAssessmentItem } from "../domain/importacao-levantamento";

interface AssessmentRow {
  id: string;
  titulo: string;
  data_inspecao: string;
  status: string;
  motivo_assessment: string | null;
  total_itens: number;
  itens_conformes: number;
  itens_nao_conformes: number;
  itens_atencao: number;
  created_at: string;
}

interface ItemRow {
  id: string;
  sistema: string;
  localizacao: string | null;
  descricao: string;
  resultado: ResultadoAssessmentItem;
  severidade: string | null;
  recomendacao: string | null;
  categoria: string | null;
  elemento: string | null;
}

function mapAssessment(row: AssessmentRow): LevantamentoResumo {
  return {
    id: row.id,
    titulo: row.titulo,
    dataInspecao: row.data_inspecao,
    status: row.status,
    motivoAssessment: row.motivo_assessment,
    totalItens: row.total_itens,
    itensConformes: row.itens_conformes,
    itensNaoConformes: row.itens_nao_conformes,
    itensAtencao: row.itens_atencao,
    criadoEm: row.created_at,
  };
}

function mapItem(row: ItemRow): ItemLevantamento {
  return {
    id: row.id,
    sistema: row.sistema,
    localizacao: row.localizacao,
    descricao: row.descricao,
    resultado: row.resultado,
    severidade: row.severidade,
    recomendacao: row.recomendacao,
    categoria: row.categoria,
    elemento: row.elemento,
  };
}

export const supabaseLevantamentoAdapter: LevantamentoGateway = {
  async criarLevantamento(input: CriarLevantamentoCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("fn_criar_assessment_pre_venda", {
        p_cliente_id: input.clienteId,
        p_titulo: input.titulo ?? null,
      })
      .single();
    if (error) throw error;
    return mapAssessment(data as AssessmentRow);
  },

  async listarLevantamentosDaConta(clienteId: string) {
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("fn_listar_assessments_conta", { p_cliente_id: clienteId });
    if (error) throw error;
    return ((data ?? []) as AssessmentRow[]).map(mapAssessment);
  },

  async listarItensLevantamento(inspecaoId: string, clienteId: string) {
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("fn_listar_itens_assessment", { p_inspecao_id: inspecaoId, p_cliente_id: clienteId });
    if (error) throw error;
    return ((data ?? []) as ItemRow[]).map(mapItem);
  },
};
