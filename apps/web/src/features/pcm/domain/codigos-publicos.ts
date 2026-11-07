export type AlvoCodigo = {
  tipo: "sistema" | "componente" | "grupo_quantitativo";
  ativoId: string;
  clienteId: string;
};
export type RegistroCodigo = AlvoCodigo & { codigo: string; natureza: "atual" | "alias" };
export type ConferenciaCodigo =
  | { situacao: "incompleto" | "ambiguo" | "nao_encontrado" }
  | { situacao: "encontrado"; alvo: AlvoCodigo };

/** Conferência informativa; não substitui autorização ou reserva transacional no servidor. */
export function conferirCodigoEmLeitura(
  codigo: string,
  registros: readonly RegistroCodigo[],
  completo: boolean,
): ConferenciaCodigo {
  if (!codigo.trim()) throw new Error("Código inválido.");
  if (!completo) return { situacao: "incompleto" };
  const encontrados = registros.filter((registro) => registro.codigo === codigo);
  const primeiro = encontrados[0];
  if (!primeiro) return { situacao: "nao_encontrado" };
  if (!primeiro.ativoId.trim() || !primeiro.clienteId.trim()) return { situacao: "incompleto" };
  if (
    encontrados.some(
      (item) =>
        item.tipo !== primeiro.tipo ||
        item.ativoId !== primeiro.ativoId ||
        item.clienteId !== primeiro.clienteId,
    )
  )
    return { situacao: "ambiguo" };
  return {
    situacao: "encontrado",
    alvo: { tipo: primeiro.tipo, ativoId: primeiro.ativoId, clienteId: primeiro.clienteId },
  };
}
