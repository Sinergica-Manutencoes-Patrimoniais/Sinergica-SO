import type { OrdemServicoOperacional, StatusOrdemServico } from "../domain/ordens-servico";

export interface AlterarStatusOsInput {
  id: string;
  status: StatusOrdemServico;
  updatedBy: string;
}

export interface HubOsGateway {
  listarOrdensServico(): Promise<OrdemServicoOperacional[]>;
  alterarStatus(input: AlterarStatusOsInput): Promise<OrdemServicoOperacional>;
}
