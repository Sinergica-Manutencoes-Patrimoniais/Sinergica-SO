import type {
  ConfigCanalFormData,
  ConfigCanalItem,
  ConfigCanalValidado,
} from "../domain/config-canal";
import type { TagFormData, TagItem } from "../domain/tags";

export interface ClienteOpcao {
  id: string;
  nome: string;
}

export interface CriarTagCommand extends TagFormData {
  userId: string;
}

export interface EditarTagCommand extends TagFormData {
  id: string;
  userId: string;
}

export interface DesativarTagCommand {
  id: string;
  userId: string;
}

export interface SalvarConfigCanalCommand extends ConfigCanalFormData {
  userId: string;
}

export interface SalvarConfigCanalGatewayInput extends ConfigCanalValidado {
  userId: string;
}

export interface ConfigGateway {
  listarClientes(): Promise<ClienteOpcao[]>;
  listarTags(): Promise<TagItem[]>;
  criarTag(input: CriarTagCommand): Promise<TagItem>;
  editarTag(input: EditarTagCommand): Promise<TagItem>;
  desativarTag(input: DesativarTagCommand): Promise<void>;
  buscarConfigCanal(clientId: string): Promise<ConfigCanalItem | null>;
  salvarConfigCanal(input: SalvarConfigCanalGatewayInput): Promise<ConfigCanalItem>;
}
