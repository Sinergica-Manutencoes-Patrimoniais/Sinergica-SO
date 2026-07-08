import type {
  CanalExternoItem,
  CanalExternoValidado,
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
  listarTemplates(): Promise<WaTemplateItem[]>;
  criarTemplate(input: CriarWaTemplateInput): Promise<WaTemplateItem>;
  editarTemplate(input: EditarWaTemplateInput): Promise<WaTemplateItem>;
}
