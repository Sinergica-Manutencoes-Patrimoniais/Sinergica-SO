// Papel do usuário — regra pura, sem I/O, sem framework (ver docs/ARCHITECTURE.md — domain/).
// Os 4 valores espelham a constraint `check` de config.usuarios (supabase/migrations/0002_E00-S05_perfis_rbac.sql).

export type Papel = "admin" | "escritorio" | "tecnico" | "cliente-sindico";

const PAPEIS_VALIDOS: readonly Papel[] = ["admin", "escritorio", "tecnico", "cliente-sindico"];

export function isPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && (PAPEIS_VALIDOS as readonly string[]).includes(valor);
}

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
}
