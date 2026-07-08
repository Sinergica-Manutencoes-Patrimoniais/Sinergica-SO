import { validarFluxo } from "../domain/fluxos";
import type { CriarFluxoCommand, FluxoGateway } from "./fluxo-gateway";

export function criarFluxo(gateway: FluxoGateway, input: CriarFluxoCommand) {
  const validado = validarFluxo(input);
  return gateway.criarFluxo({ ...validado, userId: input.userId });
}
