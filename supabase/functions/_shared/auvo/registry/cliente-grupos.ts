import type { AuvoEntityDescriptor } from "./types.ts";

export interface ClienteGrupoRow extends Record<string, unknown> {
  id: string;
  nome: string;
  clientes_auvo_ids?: number[] | null;
  auvo_id?: number | null;
}

export interface AuvoCustomerGroup {
  id?: number;
  externalId?: string;
  description?: string;
  clientsId?: number[];
}

export const clienteGruposDescriptor: AuvoEntityDescriptor<AuvoCustomerGroup, ClienteGrupoRow> = {
  key: "cliente_grupos",
  auvoBasePath: "/customergroups",
  pcmTable: "cliente_grupos",
  cronSchedule: "0 6 * * *",
  writeEnabled: false,
  deleteStrategy: "hard-delete",
  supportsUpdate: false,
  toAuvo(row) {
    return {
      description: row.nome,
      clientsId: row.clientes_auvo_ids ?? [],
    };
  },
  fromAuvo(auvo) {
    return {
      nome: textoOuFallback(auvo.description, `Grupo ${auvo.id ?? ""}`.trim()),
    };
  },
};

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
