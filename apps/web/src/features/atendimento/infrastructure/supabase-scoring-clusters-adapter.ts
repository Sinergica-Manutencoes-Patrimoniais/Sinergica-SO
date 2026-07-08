import { supabase } from "../../../lib/supabase-client";
import type {
  CriarClusterRegraInput,
  SalvarLeadScoringConfigInput,
  ScoringClustersGateway,
} from "../application/scoring-clusters-gateway";
import type { ClusterRegraItem, LeadScoringConfigItem, LeadTier } from "../domain/scoring-clusters";

interface ScoringConfigRow {
  id: string;
  window_days: number;
  behavior_cap: number;
  rescore_cooldown_seconds: number;
  score_reached_threshold: number;
}

interface ClusterRow {
  id: string;
  nome: string;
  lead_tier: LeadTier | null;
  segmento: string | null;
  subsegmento: string | null;
  ativo: boolean;
}

function mapScoringConfig(row: ScoringConfigRow): LeadScoringConfigItem {
  return {
    id: row.id,
    windowDays: row.window_days,
    behaviorCap: row.behavior_cap,
    rescoreCooldownSeconds: row.rescore_cooldown_seconds,
    scoreReachedThreshold: row.score_reached_threshold,
  };
}

function mapCluster(row: ClusterRow): ClusterRegraItem {
  return {
    id: row.id,
    nome: row.nome,
    leadTier: row.lead_tier,
    segmento: row.segmento,
    subsegmento: row.subsegmento,
    ativo: row.ativo,
  };
}

export const supabaseScoringClustersAdapter: ScoringClustersGateway = {
  async buscarLeadScoringConfig() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("lead_scoring_config")
      .select("id,window_days,behavior_cap,rescore_cooldown_seconds,score_reached_threshold")
      .limit(1)
      .single();
    if (error) throw error;
    return mapScoringConfig(data as ScoringConfigRow);
  },

  async salvarLeadScoringConfig(input: SalvarLeadScoringConfigInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("lead_scoring_config")
      .update({
        window_days: input.windowDays,
        behavior_cap: input.behaviorCap,
        rescore_cooldown_seconds: input.rescoreCooldownSeconds,
        score_reached_threshold: input.scoreReachedThreshold,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select("id,window_days,behavior_cap,rescore_cooldown_seconds,score_reached_threshold")
      .single();
    if (error) throw error;
    return mapScoringConfig(data as ScoringConfigRow);
  },

  async listarClusterRegras() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("cluster_regras")
      .select("id,nome,lead_tier,segmento,subsegmento,ativo")
      .order("nome");
    if (error) throw error;
    return ((data ?? []) as ClusterRow[]).map(mapCluster);
  },

  async criarClusterRegra(input: CriarClusterRegraInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("cluster_regras")
      .insert({
        nome: input.nome,
        lead_tier: input.leadTier,
        segmento: input.segmento,
        subsegmento: input.subsegmento,
        created_by: input.userId,
      })
      .select("id,nome,lead_tier,segmento,subsegmento,ativo")
      .single();
    if (error) throw error;
    return mapCluster(data as ClusterRow);
  },

  async desativarClusterRegra(id: string) {
    const { error } = await supabase
      .schema("atendimento")
      .from("cluster_regras")
      .update({ ativo: false })
      .eq("id", id);
    if (error) throw error;
  },
};
