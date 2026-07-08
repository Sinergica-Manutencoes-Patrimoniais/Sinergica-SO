import type { FluxoFormData, FluxoItem, PassoFluxo } from "../domain/fluxos";

export interface CriarFluxoCommand extends FluxoFormData {
  userId: string;
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
}
