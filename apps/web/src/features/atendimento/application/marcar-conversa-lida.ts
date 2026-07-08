import type { AtendimentoGateway, MarcarConversaLidaCommand } from "./atendimento-gateway";

export function marcarConversaLida(gateway: AtendimentoGateway, input: MarcarConversaLidaCommand) {
  if (!input.conversaId) throw new Error("Conversa é obrigatória.");
  return gateway.marcarComoLida(input);
}
