import type {
  CanalOptOut,
  IgAutomationItem,
  IgAutomationValidado,
  OptOutItem,
} from "../domain/automacao";

export interface CriarIgAutomationInput extends IgAutomationValidado {
  userId: string;
}

/** Opt-outs é read-only + remoção (mesmo padrão de heziomos `FlowOptoutsTab`) — o registro em si
 * vem do cliente pedindo pra sair (webhook/fluxo), nunca criado manualmente aqui. */
export interface AutomacaoGateway {
  listarIgAutomations(): Promise<IgAutomationItem[]>;
  criarIgAutomation(input: CriarIgAutomationInput): Promise<IgAutomationItem>;
  desativarIgAutomation(id: string): Promise<void>;
  listarOptOuts(): Promise<OptOutItem[]>;
  removerOptOut(id: string): Promise<void>;
  criarOptOut(input: {
    contatoId: string;
    canal: CanalOptOut;
    motivo: string | null;
    userId: string;
  }): Promise<OptOutItem>;
}
