import type {
  EvolutionAcaoResultado,
  EvolutionCriarValidado,
  EvolutionInstancia,
} from "../domain/evolution";

export interface EvolutionGateway {
  listar(): Promise<EvolutionInstancia[]>;
  criar(input: EvolutionCriarValidado & { userId: string }): Promise<EvolutionAcaoResultado>;
  conectar(id: string): Promise<EvolutionAcaoResultado>;
  sincronizarWebhook(id: string): Promise<EvolutionInstancia>;
  desconectar(id: string): Promise<EvolutionInstancia>;
}
