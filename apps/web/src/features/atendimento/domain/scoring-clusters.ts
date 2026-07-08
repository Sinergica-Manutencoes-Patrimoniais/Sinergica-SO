export interface LeadScoringConfigItem {
  id: string;
  windowDays: number;
  behaviorCap: number;
  rescoreCooldownSeconds: number;
  scoreReachedThreshold: number;
}

export interface LeadScoringConfigFormData {
  windowDays: string;
  behaviorCap: string;
  rescoreCooldownSeconds: string;
  scoreReachedThreshold: string;
}

export interface LeadScoringConfigValidado {
  windowDays: number;
  behaviorCap: number;
  rescoreCooldownSeconds: number;
  scoreReachedThreshold: number;
}

function inteiroPositivo(valor: string, campo: string): number {
  const numero = Number(valor.trim());
  if (!Number.isInteger(numero) || numero < 0)
    throw new Error(`${campo} deve ser um número inteiro (≥ 0).`);
  return numero;
}

export function validarLeadScoringConfig(
  input: LeadScoringConfigFormData,
): LeadScoringConfigValidado {
  return {
    windowDays: inteiroPositivo(input.windowDays, "Janela (dias)"),
    behaviorCap: inteiroPositivo(input.behaviorCap, "Teto de comportamento"),
    rescoreCooldownSeconds: inteiroPositivo(input.rescoreCooldownSeconds, "Cooldown de recálculo"),
    scoreReachedThreshold: inteiroPositivo(input.scoreReachedThreshold, "Limiar de score atingido"),
  };
}

export type LeadTier = "A" | "B" | "C" | "D";

export interface ClusterRegraItem {
  id: string;
  nome: string;
  leadTier: LeadTier | null;
  segmento: string | null;
  subsegmento: string | null;
  ativo: boolean;
}

export interface ClusterRegraFormData {
  nome: string;
  leadTier: LeadTier | "";
  segmento: string;
  subsegmento: string;
}

export interface ClusterRegraValidado {
  nome: string;
  leadTier: LeadTier | null;
  segmento: string | null;
  subsegmento: string | null;
}

export function validarClusterRegra(input: ClusterRegraFormData): ClusterRegraValidado {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do cluster é obrigatório.");
  return {
    nome,
    leadTier: input.leadTier || null,
    segmento: input.segmento.trim() || null,
    subsegmento: input.subsegmento.trim() || null,
  };
}
