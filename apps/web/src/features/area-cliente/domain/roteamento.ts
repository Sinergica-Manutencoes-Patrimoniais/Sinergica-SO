import type { Papel } from "../../auth/domain/role";

export function deveUsarPortal(papel: Papel): boolean {
  return papel === "cliente-sindico";
}
