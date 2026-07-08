import { validarClusterRegra, validarLeadScoringConfig } from "../domain/scoring-clusters";
import type { ClusterRegraFormData, LeadScoringConfigFormData } from "../domain/scoring-clusters";
import type { ScoringClustersGateway } from "./scoring-clusters-gateway";

export async function buscarLeadScoringConfig(gateway: ScoringClustersGateway) {
  return gateway.buscarLeadScoringConfig();
}

export async function salvarLeadScoringConfig(
  gateway: ScoringClustersGateway,
  input: LeadScoringConfigFormData & { id: string; userId: string },
) {
  const validado = validarLeadScoringConfig(input);
  return gateway.salvarLeadScoringConfig({ ...validado, id: input.id, userId: input.userId });
}

export async function listarClusterRegras(gateway: ScoringClustersGateway) {
  return gateway.listarClusterRegras();
}

export async function criarClusterRegra(
  gateway: ScoringClustersGateway,
  input: ClusterRegraFormData & { userId: string },
) {
  const validado = validarClusterRegra(input);
  return gateway.criarClusterRegra({ ...validado, userId: input.userId });
}

export async function desativarClusterRegra(gateway: ScoringClustersGateway, id: string) {
  return gateway.desativarClusterRegra(id);
}
