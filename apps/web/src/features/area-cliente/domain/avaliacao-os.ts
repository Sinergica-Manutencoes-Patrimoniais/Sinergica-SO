/** E01-S207: OS que o síndico ainda pode avaliar = finalizada (status canônico; a policy
 * `portal_satisfacao_insert`, migration 1914, exige o mesmo) e sem avaliação registrada. */
export function osAguardandoAvaliacao<T extends { id: string; status: string }>(
  os: readonly T[],
  avaliadas: ReadonlySet<string>,
): T[] {
  return os.filter((item) => item.status === "finalizado" && !avaliadas.has(item.id));
}
