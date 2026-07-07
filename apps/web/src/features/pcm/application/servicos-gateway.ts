import type { ServicoFormData, ServicoItem } from "../domain/servicos";

export interface ServicoCommand extends ServicoFormData {
  userId: string;
}

export interface EditarServicoCommand extends ServicoCommand {
  id: string;
}

export interface DesativarServicoCommand {
  id: string;
  userId: string;
}

export interface ServicosGateway {
  listar(): Promise<ServicoItem[]>;
  criar(input: ServicoCommand): Promise<ServicoItem>;
  editar(input: EditarServicoCommand): Promise<ServicoItem>;
  desativar(input: DesativarServicoCommand): Promise<void>;
}
