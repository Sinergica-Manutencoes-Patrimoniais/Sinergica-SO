import { validarInstanciaAgente } from "../domain/instancias-agente";
import type { ConfigGateway, CriarInstanciaAgenteCommand } from "./config-gateway";

export function criarInstanciaAgente(gateway: ConfigGateway, input: CriarInstanciaAgenteCommand) {
  const validado = validarInstanciaAgente(input);
  return gateway.criarInstanciaAgente({ ...validado, userId: input.userId });
}
