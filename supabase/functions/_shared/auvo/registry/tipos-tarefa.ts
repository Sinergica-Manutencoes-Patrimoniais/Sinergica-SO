import type { AuvoEntityDescriptor } from "./types.ts";

export interface TipoTarefaRow extends Record<string, unknown> {
  id: string;
  nome: string;
  preenche_relato?: boolean | null;
  exige_assinatura?: boolean | null;
  fotos_minimas?: number | null;
  ativo?: boolean | null;
  auvo_id?: number | null;
}

export interface AuvoTaskType {
  id?: number;
  description?: string;
  active?: boolean;
  standartQuestionnaireId?: number | null;
  standartTime?: string | null;
  sendSatisfactionSurvey?: boolean;
  sendDigitalOs?: boolean;
  requirements?: {
    fillReport?: boolean;
    getSignature?: boolean;
    fillRolledKilometer?: boolean;
    emailTheTask?: boolean;
    minimumNumberOfPhotos?: number;
    requiredQuestionnaires?: unknown[];
  };
}

export const tiposTarefaDescriptor: AuvoEntityDescriptor<AuvoTaskType, TipoTarefaRow> = {
  key: "tipos_tarefa",
  auvoBasePath: "/tasktypes",
  pcmTable: "tipos_tarefa",
  cronSchedule: "0 6 * * *",
  writeEnabled: true,
  // PATCH respondeu 200 mas ignorou description no teste de contrato; create/delete são válidos,
  // porém edição continua local até o Auvo disponibilizar um update efetivo.
  supportsUpdate: false,
  toAuvo(row) {
    return {
      description: row.nome,
      active: row.ativo !== false,
      requirements: {
        fillReport: row.preenche_relato === true,
        getSignature: row.exige_assinatura === true,
        minimumNumberOfPhotos: Math.max(0, Number(row.fotos_minimas ?? 0)),
      },
    };
  },
  fromAuvo(auvo) {
    return {
      nome: textoOuFallback(auvo.description, `Tipo de tarefa ${auvo.id ?? ""}`.trim()),
      ativo: auvo.active !== false,
      preenche_relato: auvo.requirements?.fillReport === true,
      exige_assinatura: auvo.requirements?.getSignature === true,
      fotos_minimas: numeroNaoNegativo(auvo.requirements?.minimumNumberOfPhotos),
    };
  },
};

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function numeroNaoNegativo(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}
