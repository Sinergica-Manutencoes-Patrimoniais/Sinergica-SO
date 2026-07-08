import type {
  ClusterRegraItem,
  ClusterRegraValidado,
  LeadScoringConfigItem,
  LeadScoringConfigValidado,
} from "../domain/scoring-clusters";

export interface SalvarLeadScoringConfigInput extends LeadScoringConfigValidado {
  id: string;
  userId: string;
}

export interface CriarClusterRegraInput extends ClusterRegraValidado {
  userId: string;
}

export interface ScoringClustersGateway {
  buscarLeadScoringConfig(): Promise<LeadScoringConfigItem>;
  salvarLeadScoringConfig(input: SalvarLeadScoringConfigInput): Promise<LeadScoringConfigItem>;
  listarClusterRegras(): Promise<ClusterRegraItem[]>;
  criarClusterRegra(input: CriarClusterRegraInput): Promise<ClusterRegraItem>;
  desativarClusterRegra(id: string): Promise<void>;
}
