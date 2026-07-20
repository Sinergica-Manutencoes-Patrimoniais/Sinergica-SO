import type {
  EquipamentoClienteOpcao,
  EquipamentoFormData,
  EquipamentoItem,
  ItemContexto,
} from "../domain/equipamentos";

export interface EquipamentoCommand extends EquipamentoFormData {
  userId: string;
}

export interface EditarEquipamentoCommand extends EquipamentoCommand {
  id: string;
}

export interface DesativarEquipamentoCommand {
  id: string;
  userId: string;
}

export interface EquipamentosGateway {
  listar(): Promise<EquipamentoItem[]>;
  listarClientes(): Promise<EquipamentoClienteOpcao[]>;
  criar(input: EquipamentoCommand): Promise<EquipamentoItem>;
  editar(input: EditarEquipamentoCommand): Promise<EquipamentoItem>;
  desativar(input: DesativarEquipamentoCommand): Promise<void>;
  possuiOsAberta(id: string): Promise<boolean>;
  // E01-S76
  obterItem(id: string): Promise<EquipamentoItem | null>;
  obterContextoItem(id: string): Promise<ItemContexto | null>;
}
