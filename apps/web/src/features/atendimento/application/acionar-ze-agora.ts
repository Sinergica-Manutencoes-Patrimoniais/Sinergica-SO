import type { AcionarZeAgoraCommand, AtendimentoGateway } from "./atendimento-gateway";

export function acionarZeAgora(gateway: AtendimentoGateway, input: AcionarZeAgoraCommand) {
  if (!input.conversaId) throw new Error("Conversa é obrigatória.");
  return gateway.acionarZeAgora(input);
}
