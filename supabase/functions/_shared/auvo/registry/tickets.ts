import type { AuvoEntityDescriptor } from "./types.ts";

export interface TicketRow extends Record<string, unknown> {
  id: string;
  titulo: string;
  descricao?: string | null;
  cliente_auvo_id?: number | null;
  equipe_auvo_id?: number | null;
  responsavel_auvo_user_id?: number | null;
  prioridade?: number | null;
  request_type_id?: number | null;
  status_id?: number | null;
  ativo?: boolean | null;
}

export interface AuvoTicket {
  id?: number;
  ticketId?: number;
  title?: string;
  description?: string;
  customerId?: number;
  teamId?: number;
  userResponsableId?: number;
  priority?: number;
  requestTypeId?: number;
  statusId?: number;
}

export const ticketsDescriptor: AuvoEntityDescriptor<AuvoTicket, TicketRow> = {
  key: "tickets",
  auvoBasePath: "/tickets",
  pcmTable: "tickets",
  webhookEntity: 62,
  writeEnabled: false,
  deleteStrategy: "unsupported",
  toAuvo(row) {
    return limparVazios({
      title: row.titulo,
      description: row.descricao,
      customerId: row.cliente_auvo_id,
      teamId: row.equipe_auvo_id,
      userResponsableId: row.responsavel_auvo_user_id,
      priority: row.prioridade,
      requestTypeId: row.request_type_id,
      statusId: row.status_id,
    });
  },
  // PATCH só documenta statusId/externalId como editáveis (spec.md → Contexto específico) —
  // título/descrição não têm caminho de edição, então o PATCH de update nunca os inclui, mesmo
  // que tenham mudado localmente.
  toAuvoUpdate(row) {
    return { statusId: row.status_id };
  },
  fromAuvo(auvo) {
    const auvoId = auvo.id ?? auvo.ticketId;
    return {
      titulo: textoOuFallback(auvo.title, `Ticket ${auvoId ?? ""}`.trim()),
      descricao: textoOuNull(auvo.description),
      cliente_auvo_id: auvo.customerId ?? null,
      equipe_auvo_id: auvo.teamId ?? null,
      responsavel_auvo_user_id: auvo.userResponsableId ?? null,
      prioridade: auvo.priority ?? null,
      request_type_id: auvo.requestTypeId ?? null,
      status_id: auvo.statusId ?? null,
    };
  },
};

function limparVazios<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      return true;
    }),
  ) as T;
}

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function textoOuNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
