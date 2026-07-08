import { validarTextoMensagem } from "../domain/mensagens";
import type { AtendimentoGateway, EnviarMensagemCommand } from "./atendimento-gateway";

export function enviarMensagem(gateway: AtendimentoGateway, input: EnviarMensagemCommand) {
  if (!input.conversaId) throw new Error("Conversa é obrigatória.");
  const texto = validarTextoMensagem(input.texto);
  return gateway.enviarMensagem({ ...input, texto });
}
