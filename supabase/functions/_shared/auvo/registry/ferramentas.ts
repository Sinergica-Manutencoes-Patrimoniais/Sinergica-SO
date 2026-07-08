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
}

export interface AuvoProduct {
  id?: number;
  productId?: number;
  name?: string;
  description?: string;
  categoryId?: number;
  unitaryValue?: number;
  unitaryCost?: number;
  minimumStock?: number;
  totalStock?: number;
  active?: boolean;
  employeesStock?: Array<{ userId?: number; amount?: number }>;
}

export const ferramentasDescriptor: AuvoEntityDescriptor<AuvoProduct, FerramentaRow> = {
  key: "ferramentas",
  auvoBasePath: "/products",
  pcmTable: "ferramentas",
  cronSchedule: "0 */6 * * *",
  writeEnabled: false,
  deleteStrategy: "soft-patch",
  toAuvo(row) {
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
      valor_unitario: numeroOuNull(auvo.unitaryValue),
      custo_unitario: numeroOuNull(auvo.unitaryCost),
      ativo: auvo.active !== false,
      employees_stock: Array.isArray(auvo.employeesStock) ? auvo.employeesStock : undefined,
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

function inteiroOuZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
}
