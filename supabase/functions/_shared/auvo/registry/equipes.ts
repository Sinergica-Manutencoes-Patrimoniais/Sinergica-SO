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
  // Confirmado direto na API real (2026-07-08): GET /teams devolve nomes (string), não ids
  // numéricos, e sob estas chaves — não `participants`/`managers` como o descriptor assumia antes
  // (causa raiz do 500 em pull:equipes, ver migration 0069). Sem endpoint de detalhe/lookup por
  // nome, não dá pra resolver com segurança para auvo_user_id sem risco de casar pessoa errada
  // por nome duplicado/typo — por isso os arrays ficam vazios até existir uma forma confiável de
  // resolução (ver STATE.md).
  teamUsers?: string[];
  teamManagers?: string[];
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
      // teamUsers/teamManagers vêm como nomes (string), não ids — ver comentário no tipo AuvoTeam.
      participantes_auvo_ids: [],
      gestores_auvo_ids: [],
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
