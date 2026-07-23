export type StatusFechamento = "aberto" | "fechado";

export interface FechamentoMensal {
  competencia: string;
  status: StatusFechamento;
  fechadoEm: string | null;
  fechadoPor: string | null;
}

export interface EventoFechamento {
  id: string;
  competencia: string;
  acao: "fechar" | "reabrir";
  motivo: string | null;
  criadoEm: string;
}

export function validarReabertura(motivo: string): string {
  const texto = motivo.trim();
  if (!texto) throw new Error("Informe o motivo da reabertura (AC-3: auditável).");
  return texto;
}
