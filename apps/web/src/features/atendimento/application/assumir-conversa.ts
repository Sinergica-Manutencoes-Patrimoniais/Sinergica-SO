import type { AssumirConversaCommand, AtendimentoGateway } from "./atendimento-gateway";

export function assumirConversa(gateway: AtendimentoGateway, input: AssumirConversaCommand) {
  if (!input.conversaId) throw new Error("Conversa é obrigatória.");
  return gateway.assumirConversa(input);
}
