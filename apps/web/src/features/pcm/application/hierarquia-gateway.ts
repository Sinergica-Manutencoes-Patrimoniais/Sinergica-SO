import type {
  Area,
  AreaFormData,
  Local,
  LocalFormData,
  LocalTipo,
  LocalTipoFormData,
} from "../domain/hierarquia";

export interface AreaCommand extends AreaFormData {
  userId: string;
}

export interface EditarAreaCommand extends AreaCommand {
  id: string;
}

export interface LocalCommand extends LocalFormData {
  userId: string;
}

export interface EditarLocalCommand extends LocalCommand {
  id: string;
}

export interface LocalTipoCommand extends LocalTipoFormData {
  userId: string;
}

export interface HierarquiaGateway {
  listarAreas(clienteId: string): Promise<Area[]>;
  criarArea(input: AreaCommand): Promise<Area>;
  editarArea(input: EditarAreaCommand): Promise<Area>;
  desativarArea(id: string, userId: string): Promise<void>;

  listarLocais(areaId: string): Promise<Local[]>;
  listarLocaisDoCliente(clienteId: string): Promise<Local[]>;
  criarLocal(input: LocalCommand): Promise<Local>;
  editarLocal(input: EditarLocalCommand): Promise<Local>;
  moverLocal(id: string, parentId: string | null, userId: string): Promise<Local>;
  desativarLocal(id: string, userId: string): Promise<void>;
  /** true se algum Item ativo (pcm.equipamentos.deleted_at is null) tem `local_id` = este Local. */
  possuiItensInstalados(localId: string): Promise<boolean>;

  /** Catálogo de Tipos de Local do cliente (ex.: "Andar", "Sala") — cadastrado uma vez, só
   * selecionado na atribuição do Local (nunca digitado). */
  listarTiposDeLocal(clienteId: string): Promise<LocalTipo[]>;
  criarTipoDeLocal(input: LocalTipoCommand): Promise<LocalTipo>;
  desativarTipoDeLocal(id: string, userId: string): Promise<void>;
}
