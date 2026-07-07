import type { AuvoEntityDescriptor } from "./types.ts";

export interface CategoriaRow extends Record<string, unknown> {
  id: string;
  nome: string;
  auvo_id?: number | null;
}

export interface AuvoCategoria {
  id?: number;
  description?: string;
  externalId?: string;
}

function criarCategoriaDescriptor(
  key: "produto_categorias" | "equipamento_categorias",
  auvoBasePath: "/productcategories" | "/equipmentcategories",
): AuvoEntityDescriptor<AuvoCategoria, CategoriaRow> {
  return {
    key,
    auvoBasePath,
    pcmTable: key,
    cronSchedule: "0 6 * * *",
    writeEnabled: false,
    deleteStrategy: "hard-delete",
    toAuvo(row) {
      return { description: row.nome };
    },
    fromAuvo(auvo) {
      return {
        nome: textoOuFallback(auvo.description, `${key} ${auvo.id ?? ""}`.trim()),
      };
    },
  };
}

export const produtoCategoriasDescriptor = criarCategoriaDescriptor(
  "produto_categorias",
  "/productcategories",
);
export const equipamentoCategoriasDescriptor = criarCategoriaDescriptor(
  "equipamento_categorias",
  "/equipmentcategories",
);

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
