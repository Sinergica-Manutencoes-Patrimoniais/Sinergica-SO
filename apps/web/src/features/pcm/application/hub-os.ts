import { filtrarBacklogGut } from "../domain/ordens-servico";
import type { AlterarStatusOsInput, HubOsGateway } from "./hub-os-gateway";

export async function listarOrdensServico(gateway: HubOsGateway) {
  return gateway.listarOrdensServico();
}

export async function listarBacklogGut(gateway: HubOsGateway) {
  return filtrarBacklogGut(await gateway.listarOrdensServico());
}

export async function alterarStatusOrdemServico(
  gateway: HubOsGateway,
  input: AlterarStatusOsInput,
) {
  return gateway.alterarStatus(input);
}

export async function planejarOrdemServico(
  gateway: HubOsGateway,
  input: Omit<AlterarStatusOsInput, "status">,
) {
  return gateway.alterarStatus({ ...input, status: "planejamento" });
}
