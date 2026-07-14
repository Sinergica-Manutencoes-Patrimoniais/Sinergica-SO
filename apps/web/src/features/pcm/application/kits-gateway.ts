import type {
  AtribuirKitFormData,
  DevolverKitFormData,
  KitAtribuicaoAtiva,
  KitFormData,
  KitItem,
} from "../domain/kits";

export interface CriarKitCommand extends KitFormData {
  userId: string;
}

export interface EditarKitCommand extends KitFormData {
  id: string;
  userId: string;
}

export interface DesativarKitCommand {
  id: string;
  userId: string;
}

export interface AtribuirKitCommand extends AtribuirKitFormData {
  userId: string;
}

export interface DevolverKitCommand extends DevolverKitFormData {
  userId: string;
}

export interface KitsGateway {
  listarKits(): Promise<KitItem[]>;
  criar(input: CriarKitCommand): Promise<KitItem>;
  editar(input: EditarKitCommand): Promise<KitItem>;
  desativar(input: DesativarKitCommand): Promise<void>;
  /** Chama `pcm.fn_atribuir_kit` (tudo-ou-nada, ver migration `0089`) — devolve o
   * `kit_atribuicao_id` gerado, ou lança se qualquer item faltar unidade. */
  atribuir(input: AtribuirKitCommand): Promise<string>;
  devolver(input: DevolverKitCommand): Promise<void>;
  listarAtribuicoesAtivas(): Promise<KitAtribuicaoAtiva[]>;
}
