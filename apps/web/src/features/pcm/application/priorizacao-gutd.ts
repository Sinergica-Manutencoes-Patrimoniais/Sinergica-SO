import { type PesosGutd, validarPesosGutd } from "../domain/priorizacao-backlog";
import type { PriorizacaoGutdGateway } from "./priorizacao-gutd-gateway";

export async function obterPesosGutdConfig(gateway: PriorizacaoGutdGateway): Promise<PesosGutd> {
  return gateway.obterPesos();
}

/** E01-S82 AC-2: valida no cliente antes de gravar (a mesma regra é reforçada por CHECK no banco —
 * `priorizacao_gutd_soma_100`, defesa em profundidade). */
export async function salvarPesosGutd(
  gateway: PriorizacaoGutdGateway,
  pesos: PesosGutd,
  updatedBy: string,
): Promise<void> {
  validarPesosGutd(pesos);
  await gateway.salvarPesos(pesos, updatedBy);
}
