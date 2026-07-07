import type { AuvoEntityDescriptor } from "./types.ts";

export interface CatalogoSimplesRow extends Record<string, unknown> {
  id: string;
  descricao: string;
  auvo_id?: number | null;
}

export interface AuvoCatalogoSimples {
  id?: number;
  description?: string;
}

function criarCatalogoSimplesDescriptor(
  key: "segmentos" | "palavras_chave",
  auvoBasePath: "/segments" | "/keywords",
): AuvoEntityDescriptor<AuvoCatalogoSimples, CatalogoSimplesRow> {
  return {
    key,
    auvoBasePath,
    pcmTable: key,
    cronSchedule: "0 6 * * *",
    writeEnabled: false,
    deleteStrategy: "hard-delete",
    toAuvo(row) {
      return { description: row.descricao };
    },
    fromAuvo(auvo) {
      return {
        descricao: textoOuFallback(auvo.description, `${key} ${auvo.id ?? ""}`.trim()),
      };
    },
  };
}

export const segmentosDescriptor = criarCatalogoSimplesDescriptor("segmentos", "/segments");
export const palavrasChaveDescriptor = criarCatalogoSimplesDescriptor(
  "palavras_chave",
  "/keywords",
);

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
