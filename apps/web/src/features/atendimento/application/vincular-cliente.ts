import type { AtendimentoGateway, VincularClienteCommand } from "./atendimento-gateway";

export function listarClientesParaVinculo(gateway: AtendimentoGateway) {
  return gateway.listarClientesParaVinculo();
}

export function vincularCliente(
  gateway: AtendimentoGateway,
  input: VincularClienteCommand,
): Promise<void> {
  if (!input.conversaId) throw new Error("Conversa é obrigatória.");
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  return gateway.vincularCliente(input);
}
