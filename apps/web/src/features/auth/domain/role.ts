// Papel do usuário — regra pura, sem I/O, sem framework (ver docs/ARCHITECTURE.md — domain/).
// Os 4 valores espelham a constraint `check` de config.usuarios (supabase/migrations/0004_E00-S08_renomear_papeis_rbac.sql).
// Renomeado de admin/escritorio/tecnico em E00-S08 — mesma matriz de permissão, só o nome mudou.

export type Papel = "superadmin" | "supervisor" | "colaborador" | "cliente-sindico";

const PAPEIS_VALIDOS: readonly Papel[] = [
  "superadmin",
  "supervisor",
  "colaborador",
  "cliente-sindico",
];

export function isPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && (PAPEIS_VALIDOS as readonly string[]).includes(valor);
}

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
}
