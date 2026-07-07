import type {
  TicketClienteOpcao,
  TicketEquipeOpcao,
  TicketFormData,
  TicketItem,
  TicketReferenciaOpcao,
} from "../domain/tickets";

export interface TicketCommand extends TicketFormData {
  userId: string;
}

export interface MudarStatusTicketCommand {
  id: string;
  statusId: number;
  userId: string;
}

export interface ArquivarTicketCommand {
  id: string;
  userId: string;
}

export interface TicketsGateway {
  listar(): Promise<TicketItem[]>;
  listarClientes(): Promise<TicketClienteOpcao[]>;
  listarEquipes(): Promise<TicketEquipeOpcao[]>;
  /** `GET /tickets/request-type` e `GET /tickets/status` via `pcm-auvo-tickets-referencia` — não
   * são entidades sincronizadas, só listas de referência para o formulário (AC-5). */
  listarReferencia(lista: "request-type" | "status"): Promise<TicketReferenciaOpcao[]>;
  criar(input: TicketCommand): Promise<TicketItem>;
  mudarStatus(input: MudarStatusTicketCommand): Promise<TicketItem>;
  arquivar(input: ArquivarTicketCommand): Promise<void>;
}
