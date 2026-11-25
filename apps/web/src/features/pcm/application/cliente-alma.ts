import { validarAlma } from "../domain/cliente-alma";
import type { ClienteAlmaGateway } from "./cliente-alma-gateway";

export function obterAlma(gateway: ClienteAlmaGateway, clienteId: string) {
  return gateway.obter(clienteId);
}

export function salvarAlma(
  gateway: ClienteAlmaGateway,
  clienteId: string,
  conteudo: string,
  userId: string,
) {
  return gateway.salvar(clienteId, validarAlma(conteudo), userId);
}

/** E02-S24 AC-3: só leitura — quem escreve o resumo rolante é o job `atendimento-memoria-resumo`. */
export function obterResumoMemoria(gateway: ClienteAlmaGateway, clienteId: string) {
  return gateway.obterResumo(clienteId);
}
