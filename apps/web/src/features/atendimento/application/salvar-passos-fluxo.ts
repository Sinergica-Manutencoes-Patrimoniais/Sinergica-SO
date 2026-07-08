import { validarPassos } from "../domain/fluxos";
import type { FluxoGateway, SalvarPassosCommand } from "./fluxo-gateway";

export function salvarPassosFluxo(gateway: FluxoGateway, input: SalvarPassosCommand) {
  if (!input.fluxoId) throw new Error("Fluxo é obrigatório.");
  const passos = validarPassos(input.passos);
  return gateway.salvarPassos({ ...input, passos });
}
