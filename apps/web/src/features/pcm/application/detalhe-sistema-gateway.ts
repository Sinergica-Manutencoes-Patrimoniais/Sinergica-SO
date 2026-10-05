import type {
  CadastroSistema,
  ComponenteSistema,
  OsSistema,
  PreventivaSistema,
} from "../domain/detalhe-sistema";

export interface DetalheSistemaGateway {
  obterCadastro(sistemaId: string, clienteEsperadoId?: string): Promise<CadastroSistema | null>;
  listarComponentes(sistemaId: string, clienteId: string): Promise<ComponenteSistema[]>;
  listarOs(sistemaId: string, clienteId: string): Promise<OsSistema[]>;
  listarPreventivas(sistemaId: string, clienteId: string): Promise<PreventivaSistema[]>;
}
