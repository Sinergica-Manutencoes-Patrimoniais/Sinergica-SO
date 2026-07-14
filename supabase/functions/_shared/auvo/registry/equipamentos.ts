import type { AuvoEntityDescriptor } from "./types.ts";

export interface EquipamentoRow extends Record<string, unknown> {
  id: string;
  nome: string;
  identificador?: string | null;
  categoria?: string | null;
  auvo_customer_id?: number | null;
  localizacao?: string | null;
  observacoes?: string | null;
  ativo?: boolean | null;
  url_imagem?: string | null;
  uri_anexos?: unknown[];
}

export interface AuvoEquipment {
  id?: number;
  equipmentId?: number;
  name?: string;
  description?: string;
  identifier?: string;
  category?: string;
  customerId?: number;
  associatedCustomerId?: number;
  location?: string;
  note?: string;
  active?: boolean;
  // E01-S71: confirmado contra a API real (2026-07-14) — GET /equipments devolve `urlImage`
  // (string, URL S3 do Auvo) e `uriAnexos` (array). Sem endpoint de escrita verificado pra esses
  // campos — só leitura (o Auvo é dono do dado de equipamento, ADR-0006).
  urlImage?: string;
  uriAnexos?: unknown[];
}

export const equipamentosDescriptor: AuvoEntityDescriptor<AuvoEquipment, EquipamentoRow> = {
  key: "equipamentos",
  auvoBasePath: "/equipments",
  pcmTable: "equipamentos",
  webhookEntity: 27,
  writeEnabled: true,
  deleteStrategy: "soft-patch",
  toAuvo(row) {
    return limparVazios({
      name: row.nome,
      description: row.nome,
      identifier: row.identificador,
      category: row.categoria,
      associatedCustomerId: row.auvo_customer_id,
      customerId: row.auvo_customer_id,
      location: row.localizacao,
      note: row.observacoes,
      active: row.ativo ?? true,
    }) as AuvoEquipment;
  },
  fromAuvo(auvo) {
    const auvoId = auvo.id ?? auvo.equipmentId;
    return {
      auvo_equipment_id: auvoId,
      nome: textoOuFallback(auvo.name ?? auvo.description, `Equipamento ${auvoId ?? ""}`.trim()),
      identificador: textoOuNull(auvo.identifier),
      categoria: textoOuNull(auvo.category),
      auvo_customer_id: auvo.associatedCustomerId ?? auvo.customerId ?? null,
      localizacao: textoOuNull(auvo.location),
      observacoes: textoOuNull(auvo.note),
      ativo: auvo.active !== false,
      url_imagem: textoOuNull(auvo.urlImage),
      uri_anexos: Array.isArray(auvo.uriAnexos) ? auvo.uriAnexos : [],
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
