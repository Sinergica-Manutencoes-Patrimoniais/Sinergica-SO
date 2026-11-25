import type {
  CanalExternoItem,
  CanalExternoValidado,
  ConexaoMetaValidada,
  EstadoCanalMeta,
  TipoCanalExterno,
  WaTemplateItem,
  WaTemplateValidado,
} from "../domain/canais-externos";

export interface CriarCanalExternoInput extends CanalExternoValidado {
  userId: string;
}

export interface EditarCanalExternoInput extends CanalExternoValidado {
  id: string;
  userId: string;
}

export interface CriarWaTemplateInput extends WaTemplateValidado {
  userId: string;
}
export interface EditarWaTemplateInput extends CriarWaTemplateInput {
  id: string;
}

export interface CanaisExternosGateway {
  listarCanais(tipo: TipoCanalExterno): Promise<CanalExternoItem[]>;
  criarCanal(input: CriarCanalExternoInput): Promise<CanalExternoItem>;
  editarCanal(input: EditarCanalExternoInput): Promise<CanalExternoItem>;
  desativarCanal(id: string): Promise<void>;
  /** E02-S16/ADR-1700: os segredos saem do browser direto para a Edge Function, que os grava no
   * Vault. A tela recebe de volta só a URL de callback para colar na Meta. */
  conectarCanalMeta(input: ConexaoMetaValidada): Promise<{ callbackUrl: string }>;
  obterEstadoMeta(canalId: string): Promise<EstadoCanalMeta>;
  verificarCanalMeta(canalId: string): Promise<void>;
  listarTemplates(): Promise<WaTemplateItem[]>;
  criarTemplate(input: CriarWaTemplateInput): Promise<WaTemplateItem>;
  editarTemplate(input: EditarWaTemplateInput): Promise<WaTemplateItem>;
}
