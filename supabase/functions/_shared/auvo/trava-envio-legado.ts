/** Trava de rollout, não serializa requisições em andamento nem autoriza o novo fluxo. */
export function envioLegadoBloqueado(valor: string | undefined): boolean {
  return valor === "true";
}
