import type {
  EspecialistaItem,
  EspecialistaValidado,
  LicaoItem,
  LicaoValidado,
} from "../domain/operacao";

export interface CriarLicaoInput extends LicaoValidado {
  personaId: string;
  userId: string;
}

export interface CriarEspecialistaInput extends EspecialistaValidado {
  personaId: string;
  userId: string;
}

export interface OperacaoGateway {
  listarLicoes(personaId: string): Promise<LicaoItem[]>;
  criarLicao(input: CriarLicaoInput): Promise<LicaoItem>;
  desativarLicao(id: string): Promise<void>;
  listarEspecialistas(personaId: string): Promise<EspecialistaItem[]>;
  criarEspecialista(input: CriarEspecialistaInput): Promise<EspecialistaItem>;
  desativarEspecialista(id: string): Promise<void>;
}
