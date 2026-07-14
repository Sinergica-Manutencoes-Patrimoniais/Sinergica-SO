import type { AuvoEntityDescriptor } from "./types.ts";

export interface FerramentaRow extends Record<string, unknown> {
  id: string;
  nome: string;
  descricao?: string | null;
  auvo_category_id?: number | null;
  quantidade_total?: number | null;
  quantidade_minima?: number | null;
  valor_unitario?: number | null;
  custo_unitario?: number | null;
  ativo?: boolean | null;
  imagem_url?: string | null;
  uri_anexos?: unknown[];
  codigo_auvo?: string | null;
}

export interface AuvoProduct {
  id?: number;
  productId?: number;
  name?: string;
  description?: string;
  categoryId?: number;
  // Confirmado direto na API real (2026-07-09): GET /products devolve `unitaryValue`/
  // `unitaryCost` como STRING formatada em moeda (ex.: `"$0.00"`), não number — `numeroOuNull`
  // exigia `typeof === "number"` e sempre gravava null, descartando o preço real. `precoOuNull`
  // abaixo aceita os dois formatos.
  unitaryValue?: number | string;
  unitaryCost?: number | string;
  minimumStock?: number;
  totalStock?: number;
  active?: boolean;
  employeesStock?: Array<{ userId?: number; amount?: number }>;
  // E01-S65: confirmado na API real (2026-07-13) — GET /products devolve `imageUrl`/
  // `uriAttachments`/`code`. Escrita (`PATCH /products/{id}` aceitando `imageUrl`) NÃO confirmada
  // ainda — por isso só entram em `fromAuvo` (leitura), nunca em `toAuvo`/`toAuvoUpdate`.
  imageUrl?: string;
  uriAttachments?: unknown[];
  code?: string;
}

export const ferramentasDescriptor: AuvoEntityDescriptor<AuvoProduct, FerramentaRow> = {
  key: "ferramentas",
  auvoBasePath: "/products",
  pcmTable: "ferramentas",
  cronSchedule: "0 */6 * * *",
  writeEnabled: true,
  deleteStrategy: "soft-patch",
  toAuvo(row) {
    return limparVazios({
      name: row.nome,
      description: row.descricao ?? row.nome,
      categoryId: row.auvo_category_id,
      totalStock: row.quantidade_total ?? 0,
      minimumStock: row.quantidade_minima ?? 0,
      active: row.ativo ?? true,
    }) as AuvoProduct;
  },
  // POST multiplicou os preços por 10 no contrato real; PATCH aceita decimal corretamente.
  toAuvoUpdate(row) {
    return limparVazios({
      name: row.nome,
      description: row.descricao ?? row.nome,
      categoryId: row.auvo_category_id,
      totalStock: row.quantidade_total ?? 0,
      minimumStock: row.quantidade_minima ?? 0,
      unitaryValue: row.valor_unitario,
      unitaryCost: row.custo_unitario,
      active: row.ativo ?? true,
    }) as AuvoProduct;
  },
  fromAuvo(auvo) {
    const auvoId = auvo.id ?? auvo.productId;
    return {
      nome: textoOuFallback(auvo.name ?? auvo.description, `Ferramenta ${auvoId ?? ""}`.trim()),
      descricao: textoOuNull(auvo.description),
      auvo_category_id: numeroOuNull(auvo.categoryId),
      quantidade_total: Math.max(0, inteiroOuZero(auvo.totalStock)),
      quantidade_minima: Math.max(0, inteiroOuZero(auvo.minimumStock)),
      valor_unitario: precoOuNull(auvo.unitaryValue),
      custo_unitario: precoOuNull(auvo.unitaryCost),
      ativo: auvo.active !== false,
      employees_stock: Array.isArray(auvo.employeesStock) ? auvo.employeesStock : undefined,
      imagem_url: textoOuNull(auvo.imageUrl),
      uri_anexos: Array.isArray(auvo.uriAttachments) ? auvo.uriAttachments : [],
      codigo_auvo: textoOuNull(auvo.code),
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

function numeroOuNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** `unitaryValue`/`unitaryCost` reais vêm formatados em moeda (ex.: `"$0.00"`) — remove tudo que
 * não é dígito/ponto antes de converter. */
function precoOuNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numero = Number.parseFloat(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

function inteiroOuZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}
