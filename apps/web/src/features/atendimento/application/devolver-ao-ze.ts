import type { AtendimentoGateway, DevolverAoZeCommand } from "./atendimento-gateway";

export function devolverAoZe(gateway: AtendimentoGateway, input: DevolverAoZeCommand) {
  if (!input.conversaId) throw new Error("Conversa é obrigatória.");
  return gateway.devolverAoZe(input);
}
