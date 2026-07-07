import type { AuvoEntityDescriptor } from "./types.ts";

export interface EquipeRow extends Record<string, unknown> {
  id: string;
  nome: string;
  participantes_auvo_ids?: number[] | null;
  gestores_auvo_ids?: number[] | null;
  ativo?: boolean | null;
}

export interface AuvoTeam {
  id?: number;
  teamId?: number;
  description?: string;
  participants?: number[];
  managers?: number[];
  active?: boolean;
}

export const equipesDescriptor: AuvoEntityDescriptor<AuvoTeam, EquipeRow> = {
  key: "equipes",
  auvoBasePath: "/teams",
  pcmTable: "equipes",
  cronSchedule: "0 */6 * * *",
  writeEnabled: false,
  supportsUpdate: false,
  deleteStrategy: "unsupported",
  toAuvo(row) {
    return {
      description: row.nome,
      participants: normalizarIds(row.participantes_auvo_ids),
      managers: normalizarIds(row.gestores_auvo_ids),
    };
  },
  fromAuvo(auvo) {
    const auvoId = auvo.id ?? auvo.teamId;
    return {
      nome: textoOuFallback(auvo.description, `Equipe ${auvoId ?? ""}`.trim()),
      participantes_auvo_ids: normalizarIds(auvo.participants),
      gestores_auvo_ids: normalizarIds(auvo.managers),
      ativo: auvo.active !== false,
    };
  },
};

function normalizarIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => Number.isInteger(item) && item > 0))];
}

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
