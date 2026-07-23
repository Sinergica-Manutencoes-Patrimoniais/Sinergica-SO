import { type StatusOrdemServico, ehOsAberta } from "../domain/ordens-servico";
import { calcularScoreGutd, ordenarPorPrioridade } from "../domain/priorizacao-backlog";
import type { AlterarStatusOsInput, FiltrosServidorOrdens, HubOsGateway } from "./hub-os-gateway";

export async function listarOrdensServico(gateway: HubOsGateway, filtros?: FiltrosServidorOrdens) {
  return gateway.listarOrdensServico(filtros);
}

/** E01-S44: KPIs via RPC (agregação server-side) — não baixa OS pra calcular os 6 números. */
export async function contarKpisOrdens(gateway: HubOsGateway, filtros?: FiltrosServidorOrdens) {
  return gateway.contarKpis(filtros);
}

/** E01-S82 AC-2: ordena pelo score GUTD ponderado (nunca gravado — recalculado aqui, em runtime,
 * a cada carregamento, com os pesos vigentes). G/U/T ausentes (nulos) caem pra 1 (mesmo fallback
 * do `score_pcm` GENERATED no banco); D ausente é tratado pelo próprio `calcularScoreGutd`
 * (redistribui peso — AC-4, não penaliza nem infla). */
export async function listarBacklogGut(gateway: HubOsGateway) {
  const [ordens, pesos] = await Promise.all([
    gateway.listarOrdensServico(),
    gateway.obterPesosGutd(),
  ]);
  const abertas = ordens.filter((ordem) => ehOsAberta(ordem.status));
  const comScore = abertas.map((ordem) => ({
    ...ordem,
    score: calcularScoreGutd(
      ordem.gravidade ?? 1,
      ordem.urgencia ?? 1,
      ordem.tendencia ?? 1,
      ordem.dorCliente,
      pesos,
    ),
  }));
  return ordenarPorPrioridade(comScore);
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
