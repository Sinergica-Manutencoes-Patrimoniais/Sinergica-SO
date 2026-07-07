import type { AuvoEntityDescriptor } from "./types.ts";

export interface ServicoRow extends Record<string, unknown> {
  id: string;
  titulo: string;
  descricao?: string | null;
  preco_centavos: number;
  fiscal_service_id?: string | null;
  ativo?: boolean | null;
}

export interface AuvoService {
  id?: string;
  serviceId?: string;
  title?: string;
  description?: string;
  price?: number;
  active?: boolean;
  fiscalServiceId?: string | null;
}

export const servicosDescriptor: AuvoEntityDescriptor<AuvoService, ServicoRow> = {
  key: "servicos",
  auvoBasePath: "/services",
  pcmTable: "servicos",
  cronSchedule: "0 */6 * * *",
  writeEnabled: false,
  deleteStrategy: "soft-patch",
  externalIdField: "externalCode",
  toAuvo(row) {
    return limparVazios({
      title: row.titulo,
      description: row.descricao,
      price: centavosParaDecimal(row.preco_centavos),
      active: row.ativo ?? true,
      fiscalServiceId: row.fiscal_service_id ?? null,
    });
  },
  fromAuvo(auvo) {
    return {
      titulo: textoOuFallback(auvo.title ?? auvo.description, `Serviço ${auvo.id ?? auvo.serviceId ?? ""}`.trim()),
      descricao: textoOuNull(auvo.description),
      preco_centavos: decimalParaCentavos(auvo.price),
      fiscal_service_id: textoOuNull(auvo.fiscalServiceId),
      ativo: auvo.active !== false,
    };
  },
};

export function centavosParaDecimal(value: number): number {
  return Math.round(value) / 100;
}

export function decimalParaCentavos(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : 0;
}

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
