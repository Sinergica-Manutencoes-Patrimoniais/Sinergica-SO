// Módulo permissionável — regra pura, sem I/O, sem framework (ver docs/ARCHITECTURE.md — domain/).
// Os 9 valores espelham o check constraint de config.grupo_modulos/config.usuario_modulos
// (supabase/migrations/0006_E00-S09_grupos_permissoes_modulo.sql) e os IDs já usados na sidebar
// (HomePage.tsx). "inicio" não é módulo permissionável — não entra nesta lista.

export type ModuloId =
  | "pcm"
  | "atendimento"
  | "comercial"
  | "financeiro"
  | "operacao"
  | "marketing"
  | "growth"
  | "gestao"
  | "area-cliente";

export type NivelAcesso = "leitura" | "escrita";

export const MODULOS_PERMISSIONAVEIS: readonly ModuloId[] = [
  "pcm",
  "atendimento",
  "comercial",
  "financeiro",
  "operacao",
  "marketing",
  "growth",
  "gestao",
  "area-cliente",
];

export function isModuloId(valor: unknown): valor is ModuloId {
  return (
    typeof valor === "string" && (MODULOS_PERMISSIONAVEIS as readonly string[]).includes(valor)
  );
}

export function isNivelAcesso(valor: unknown): valor is NivelAcesso {
  return valor === "leitura" || valor === "escrita";
}
