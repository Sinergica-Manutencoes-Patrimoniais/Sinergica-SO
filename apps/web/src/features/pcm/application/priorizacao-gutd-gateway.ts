import type { PesosGutd } from "../domain/priorizacao-backlog";

export interface PriorizacaoGutdGateway {
  obterPesos(): Promise<PesosGutd>;
  salvarPesos(pesos: PesosGutd, updatedBy: string): Promise<void>;
}
