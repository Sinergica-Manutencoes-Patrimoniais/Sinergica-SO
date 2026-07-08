import type { ConversaItem, StatusConversa } from "../domain/conversas";
import type { MensagemItem } from "../domain/mensagens";
import type { MensagemRicaInput } from "../domain/mensagens";

export interface EnviarMensagemCommand {
  conversaId: string;
  texto: string;
}

export interface AssumirConversaCommand {
  conversaId: string;
  userId: string;
}

export interface DevolverAoZeCommand {
  conversaId: string;
}

export interface MarcarConversaLidaCommand {
  conversaId: string;
}

export interface AcionarZeAgoraCommand {
  conversaId: string;
}

export interface AtendimentoGateway {
  listarConversas(filtro?: { status?: StatusConversa }): Promise<ConversaItem[]>;
  listarMensagens(conversaId: string): Promise<MensagemItem[]>;
  enviarMensagem(input: EnviarMensagemCommand): Promise<MensagemItem>;
  assumirConversa(input: AssumirConversaCommand): Promise<void>;
  devolverAoZe(input: DevolverAoZeCommand): Promise<void>;
  marcarComoLida(input: MarcarConversaLidaCommand): Promise<void>;
  acionarZeAgora(input: AcionarZeAgoraCommand): Promise<void>;
  enviarMensagemRica(input: MensagemRicaInput & { conversaId: string }): Promise<MensagemItem>;
  atualizarTags(conversaId: string, tags: string[]): Promise<void>;
}
