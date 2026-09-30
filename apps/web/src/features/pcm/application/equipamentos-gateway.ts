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

/** E01-S155: move um Componente na árvore (Board, painel "Itens PCM" da 360) sem passar pelas
 * validações de `validarEquipamento` (cliente/categoria obrigatórios) — mover um item legado
 * incompleto não pode ficar bloqueado por regras que só valem na criação/edição pelo modal. */
export interface AtualizarPosicaoComponenteCommand {
  id: string;
  areaId: string | null;
  localId: string | null;
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
  // E01-S155
  atualizarPosicao(input: AtualizarPosicaoComponenteCommand): Promise<void>;
}
