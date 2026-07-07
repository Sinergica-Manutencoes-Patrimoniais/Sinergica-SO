export interface TicketItem {
  id: string;
  titulo: string;
  descricao: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  equipeId: string | null;
  equipeNome: string | null;
  responsavelAuvoUserId: number | null;
  prioridade: number | null;
  requestTypeId: number | null;
  statusId: number | null;
  ativo: boolean;
  auvoId: number | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
}

export interface TicketClienteOpcao {
  id: string;
  nome: string;
  auvoId: number | null;
}

export interface TicketEquipeOpcao {
  id: string;
  nome: string;
  auvoId: number | null;
}

export interface TicketReferenciaOpcao {
  id: number;
  nome: string;
}

export interface TicketFormData {
  titulo: string;
  descricao: string | null;
  clienteId: string;
  equipeId: string | null;
  prioridade: number | null;
  requestTypeId: number | null;
  statusId: number | null;
}

/** AC-1 + caso de borda: cliente é obrigatório e precisa estar sincronizado com o Auvo (sem
 * `auvoId`, o drain não consegue montar `customerId` no `POST /tickets/`). */
export function validarNovoTicket(
  input: TicketFormData,
  clientes: TicketClienteOpcao[],
): TicketFormData {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  const cliente = clientes.find((item) => item.id === input.clienteId);
  if (!cliente) throw new Error("Cliente é obrigatório.");
  if (!cliente.auvoId) {
    throw new Error("Sincronize o cliente com o Auvo antes de abrir um Ticket.");
  }
  return {
    titulo,
    descricao: input.descricao?.trim() || null,
    clienteId: input.clienteId,
    equipeId: input.equipeId || null,
    prioridade: input.prioridade,
    requestTypeId: input.requestTypeId,
    statusId: input.statusId,
  };
}

/** AC-2: única mudança que propaga ao Auvo (`toAuvoUpdate` do descriptor só emite `statusId`). */
export function validarMudancaStatus(
  id: string,
  statusId: number | null,
): { id: string; statusId: number } {
  if (!id) throw new Error("Ticket é obrigatório.");
  if (statusId == null) throw new Error("Status é obrigatório.");
  return { id, statusId };
}
