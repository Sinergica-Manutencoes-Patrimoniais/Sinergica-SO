import { registrarDespesaVisitaSchema, type RegistrarDespesaVisita } from "@sinergica/shared";

export interface DespesasVisitaGateway {
  criar(
    input: RegistrarDespesaVisita,
  ): Promise<{ aggregateId: string; revision: number; state: string }>;
}

/** Criação inicial sem comprovantes; operações posteriores exigem contratos ainda não disponíveis. */
export async function criarDespesaVisita(
  gateway: DespesasVisitaGateway,
  input: RegistrarDespesaVisita,
) {
  const pedido = registrarDespesaVisitaSchema.parse(input);
  if (pedido.expectedRevision !== undefined || pedido.comprovantes.length !== 0)
    throw new Error("Edição e comprovantes ainda não disponíveis.");
  return gateway.criar(pedido);
}
