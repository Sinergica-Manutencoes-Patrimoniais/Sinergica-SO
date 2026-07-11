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
  // `/productcategories` (produto_categorias) confirmado 404 direto na API real (2026-07-08),
  // mesmo testando o casing exato do doc oficial ("/productCategories") — a conta Auvo
  // provavelmente não tem o módulo de Catálogo/Produtos habilitado no plano
  // (equipmentcategories, mesma forma de endpoint, funciona normalmente). Sem cron pra não
  // poluir a saúde de sync com erro permanente e irrecuperável por código; decisão de negócio
  // (confirmar/ativar o módulo junto ao Auvo) é do Lucas — ver STATE.md.
  const semCron = key === "produto_categorias";
  return {
    key,
    auvoBasePath,
    pcmTable: key,
    ...(semCron ? {} : { cronSchedule: "0 6 * * *" }),
    writeEnabled: key === "equipamento_categorias",
    // DELETE respondeu 204 mas o GET ainda devolveu o registro no teste vivo; não prometer
    // exclusão remota até o Auvo esclarecer a semântica.
    deleteStrategy: key === "equipamento_categorias" ? "unsupported" : "hard-delete",
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
