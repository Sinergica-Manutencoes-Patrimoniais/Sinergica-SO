import {
  type PrioridadeBacklog,
  calcularScoreGut,
  classificarPrioridade,
} from "./priorizacao-backlog";

export type CategoriaOs =
  | "corretiva"
  | "preventiva"
  | "melhoria"
  | "inspecao"
  | "emergencial"
  | "outro";

export type OrigemOs = "manual" | "solicitacao_cliente" | "telefone" | "vistoria" | "ze" | "portal";

export interface OpcaoSelect<T extends string = string> {
  value: T;
  label: string;
}

export const CATEGORIAS_OS: OpcaoSelect<CategoriaOs>[] = [
  { value: "corretiva", label: "Corretiva" },
  { value: "preventiva", label: "Preventiva" },
  { value: "melhoria", label: "Melhoria" },
  { value: "inspecao", label: "Inspeção" },
  { value: "emergencial", label: "Atendimento Emergencial" },
  { value: "outro", label: "Outro" },
];

export const ORIGENS_OS: OpcaoSelect<OrigemOs>[] = [
  { value: "manual", label: "Manual / escritório" },
  { value: "solicitacao_cliente", label: "Solicitação cliente" },
  { value: "telefone", label: "Telefone" },
  { value: "vistoria", label: "Vistoria interna" },
  { value: "ze", label: "Agente Zé" },
  { value: "portal", label: "Área do Cliente" },
];

export const TIPOS_AUVO: OpcaoSelect[] = [
  { value: "manutencao", label: "Manutenção" },
  { value: "corretiva", label: "Corretiva" },
  { value: "preventiva", label: "Preventiva" },
  { value: "ar-condicionado", label: "Ar-Condicionado" },
  { value: "bomba", label: "Bomba" },
  { value: "quadro-eletrico", label: "Quadro Elétrico" },
  { value: "luminaria", label: "Luminária" },
  { value: "porta-portao", label: "Porta / Portão" },
  { value: "extintor", label: "Extintor" },
  { value: "hidrante", label: "Hidrante" },
  { value: "ronda-semanal", label: "BRP Ronda Semanal" },
  { value: "ronda-diaria", label: "Luggo Ronda Diária" },
  { value: "tennessee-ronda", label: "Tennessee Ronda" },
  { value: "levantamento", label: "Levantamento de Serviço" },
  { value: "emergencial", label: "Atendimento Emergencial" },
];

const TIPO_POR_CATEGORIA: Record<CategoriaOs, string> = {
  corretiva: "corretiva",
  preventiva: "preventiva",
  melhoria: "levantamento",
  inspecao: "manutencao",
  emergencial: "emergencial",
  outro: "manutencao",
};

export function sugerirTipoAuvo(categoria: CategoriaOs): string {
  return TIPO_POR_CATEGORIA[categoria];
}

export function sugerirPrioridadePorGut(
  gravidade: number,
  urgencia: number,
  tendencia: number,
): PrioridadeBacklog {
  return classificarPrioridade(calcularScoreGut(gravidade, urgencia, tendencia));
}

export function prioridadeParaOs(
  prioridade: PrioridadeBacklog,
): "baixa" | "normal" | "media" | "alta" | "critica" {
  return prioridade === "baixa" ? "baixa" : prioridade === "media" ? "media" : prioridade;
}
