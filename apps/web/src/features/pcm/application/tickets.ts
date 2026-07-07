import { validarMudancaStatus, validarNovoTicket } from "../domain/tickets";
import type {
  ArquivarTicketCommand,
  MudarStatusTicketCommand,
  TicketCommand,
  TicketsGateway,
} from "./tickets-gateway";

export function listarTickets(gateway: TicketsGateway) {
  return gateway.listar();
}

export function listarClientesTicket(gateway: TicketsGateway) {
  return gateway.listarClientes();
}

export function listarEquipesTicket(gateway: TicketsGateway) {
  return gateway.listarEquipes();
}

export function listarReferenciaTicket(gateway: TicketsGateway, lista: "request-type" | "status") {
  return gateway.listarReferencia(lista);
}

export async function criarTicket(gateway: TicketsGateway, input: TicketCommand) {
  const clientes = await gateway.listarClientes();
  const validado = validarNovoTicket(input, clientes);
  return gateway.criar({ ...validado, userId: input.userId });
}

export function mudarStatusTicket(gateway: TicketsGateway, input: MudarStatusTicketCommand) {
  validarMudancaStatus(input.id, input.statusId);
  return gateway.mudarStatus(input);
}

export function arquivarTicket(gateway: TicketsGateway, input: ArquivarTicketCommand) {
  if (!input.id) throw new Error("Ticket é obrigatório.");
  return gateway.arquivar(input);
}
