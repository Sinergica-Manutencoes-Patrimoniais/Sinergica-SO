import { type StatusOrdemServico, filtrarBacklogGut } from "../domain/ordens-servico";
import type { AlterarStatusOsInput, FiltrosServidorOrdens, HubOsGateway } from "./hub-os-gateway";

export async function listarOrdensServico(gateway: HubOsGateway, filtros?: FiltrosServidorOrdens) {
  return gateway.listarOrdensServico(filtros);
}

/** E01-S44: KPIs via RPC (agregação server-side) — não baixa OS pra calcular os 6 números. */
export async function contarKpisOrdens(gateway: HubOsGateway, filtros?: FiltrosServidorOrdens) {
  return gateway.contarKpis(filtros);
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

export interface ResultadoLote {
  sucesso: string[];
  falhas: Array<{ id: string; erro: string }>;
}

/** E01-S43: aplica o mesmo status a várias OS de uma vez. Um `UPDATE` por OS via
 * `Promise.allSettled` (sem RPC nova) — falha isolada não trava as demais (AC-3). */
export async function alterarStatusEmLote(
  gateway: HubOsGateway,
  ids: string[],
  status: StatusOrdemServico,
  updatedBy: string,
): Promise<ResultadoLote> {
  const resultados = await Promise.allSettled(
    ids.map((id) => gateway.alterarStatus({ id, status, updatedBy })),
  );
  const sucesso: string[] = [];
  const falhas: Array<{ id: string; erro: string }> = [];
  resultados.forEach((resultado, index) => {
    const id = ids[index];
    if (!id) return;
    if (resultado.status === "fulfilled") {
      sucesso.push(id);
    } else {
      falhas.push({
        id,
        erro: resultado.reason instanceof Error ? resultado.reason.message : "Falha desconhecida",
      });
    }
  });
  return { sucesso, falhas };
}
