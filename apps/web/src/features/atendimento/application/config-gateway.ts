import type {
  ConfigCanalFormData,
  ConfigCanalItem,
  ConfigCanalValidado,
} from "../domain/config-canal";
import type { InstanciaAgenteFormData, InstanciaAgenteItem } from "../domain/instancias-agente";
import type { ConfigOperacaoValidado } from "../domain/operacao";
import type {
  ConfigIaValidado,
  PersonaFormData,
  PersonaItem,
  PersonaValidado,
} from "../domain/personas";
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

export interface CriarPersonaCommand extends PersonaFormData {
  userId: string;
}

export interface EditarPersonaCommand extends PersonaFormData {
  id: string;
  userId: string;
}

export interface CriarPersonaGatewayInput extends PersonaValidado {
  userId: string;
}

export interface EditarPersonaGatewayInput extends PersonaValidado {
  id: string;
  userId: string;
}

export interface DesativarPersonaCommand {
  id: string;
  userId: string;
}

export interface CriarInstanciaAgenteCommand extends InstanciaAgenteFormData {
  userId: string;
}

export interface DesativarInstanciaAgenteCommand {
  id: string;
  userId: string;
}

export interface SalvarConfigIaGatewayInput extends ConfigIaValidado {
  personaId: string;
  userId: string;
}

export interface SalvarConfigOperacaoGatewayInput extends ConfigOperacaoValidado {
  personaId: string;
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
  listarPersonas(): Promise<PersonaItem[]>;
  criarPersona(input: CriarPersonaGatewayInput): Promise<PersonaItem>;
  editarPersona(input: EditarPersonaGatewayInput): Promise<PersonaItem>;
  desativarPersona(input: DesativarPersonaCommand): Promise<void>;
  salvarConfigIa(input: SalvarConfigIaGatewayInput): Promise<PersonaItem>;
  salvarConfigOperacao(input: SalvarConfigOperacaoGatewayInput): Promise<PersonaItem>;
  listarInstanciasAgente(): Promise<InstanciaAgenteItem[]>;
  criarInstanciaAgente(input: CriarInstanciaAgenteCommand): Promise<InstanciaAgenteItem>;
  desativarInstanciaAgente(input: DesativarInstanciaAgenteCommand): Promise<void>;
}
