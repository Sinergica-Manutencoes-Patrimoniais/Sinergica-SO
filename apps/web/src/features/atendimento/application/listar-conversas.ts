import type { StatusConversa } from "../domain/conversas";
import type { AtendimentoGateway } from "./atendimento-gateway";

export function listarConversas(gateway: AtendimentoGateway, filtro?: { status?: StatusConversa }) {
  return gateway.listarConversas(filtro);
}
