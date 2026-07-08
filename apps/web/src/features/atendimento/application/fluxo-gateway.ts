import type { FluxoFormData, FluxoItem, FluxoLog, FluxoRecipe, PassoFluxo } from "../domain/fluxos";

export interface CriarFluxoCommand extends FluxoFormData {
  userId: string;
  definicao?: PassoFluxo[];
}

export interface SalvarPassosCommand {
  fluxoId: string;
  passos: PassoFluxo[];
  userId: string;
}

export interface DesativarFluxoCommand {
  id: string;
  userId: string;
}

export interface FluxoGateway {
  listarFluxos(): Promise<FluxoItem[]>;
  criarFluxo(input: CriarFluxoCommand): Promise<FluxoItem>;
  salvarPassos(input: SalvarPassosCommand): Promise<FluxoItem>;
  desativarFluxo(input: DesativarFluxoCommand): Promise<void>;
  listarRecipes(): Promise<FluxoRecipe[]>;
  listarLogs(fluxoId: string): Promise<FluxoLog[]>;
}
