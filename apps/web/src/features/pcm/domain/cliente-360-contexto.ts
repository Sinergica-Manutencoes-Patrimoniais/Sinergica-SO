export type TipoContextoDetalhe360 =
  | "os"
  | "chamado"
  | "ocorrencia_preventiva"
  | "plano_preventivo";

/** Estado efêmero de um detalhe aberto dentro do Cliente 360; nunca é uma autorização. */
export type ContextoDetalhe360 = {
  tipo: TipoContextoDetalhe360;
  id: string;
  clienteId: string;
  originElementId?: string;
};

export function contextoPertenceAoCliente(
  contexto: ContextoDetalhe360 | null,
  clienteId: string,
): boolean {
  return contexto !== null && contexto.clienteId === clienteId;
}

/** A troca de cliente jamais reaproveita uma seleção pertencente ao cliente anterior. */
export function contextoAposTrocaDeCliente(
  contexto: ContextoDetalhe360 | null,
  clienteIdAnterior: string,
  proximoClienteId: string,
): ContextoDetalhe360 | null {
  if (clienteIdAnterior !== proximoClienteId) return null;
  return contextoPertenceAoCliente(contexto, proximoClienteId) ? contexto : null;
}
