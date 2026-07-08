import type { DesativarFluxoCommand, FluxoGateway } from "./fluxo-gateway";

export function desativarFluxo(gateway: FluxoGateway, input: DesativarFluxoCommand) {
  if (!input.id) throw new Error("Fluxo é obrigatório.");
  return gateway.desativarFluxo(input);
}
