import type { AtendimentoGateway } from "./atendimento-gateway";

export function listarMensagens(gateway: AtendimentoGateway, conversaId: string) {
  if (!conversaId) throw new Error("Conversa é obrigatória.");
  return gateway.listarMensagens(conversaId);
}
