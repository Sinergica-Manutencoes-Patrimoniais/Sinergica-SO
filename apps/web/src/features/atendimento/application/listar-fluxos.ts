import type { FluxoGateway } from "./fluxo-gateway";

export function listarFluxos(gateway: FluxoGateway) {
  return gateway.listarFluxos();
}
