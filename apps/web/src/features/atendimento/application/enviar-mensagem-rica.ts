import type { CanalConversa } from "../domain/conversas";
import { validarMensagemRica } from "../domain/mensagens";
import type { MensagemRicaInput } from "../domain/mensagens";
import type { AtendimentoGateway } from "./atendimento-gateway";

export function enviarMensagemRica(
  gateway: AtendimentoGateway,
  input: MensagemRicaInput & { conversaId: string; canal: CanalConversa },
) {
  const { canal, ...command } = input;
  return gateway.enviarMensagemRica({
    ...command,
    ...validarMensagemRica(command, canal),
  });
}

export function atualizarTagsConversa(
  gateway: AtendimentoGateway,
  conversaId: string,
  tags: string[],
) {
  return gateway.atualizarTags(conversaId, [
    ...new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
  ]);
}
