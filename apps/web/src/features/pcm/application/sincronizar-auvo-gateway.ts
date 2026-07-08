export interface SincronizacaoAuvoEtapa {
  step: string;
  ok: boolean;
  error?: string;
}

export interface SincronizacaoAuvoResultado {
  ok: boolean;
  syncedAt: string;
  etapas: SincronizacaoAuvoEtapa[];
}

/** Porta do botão global "Sincronizar Auvo" (E01-S37) — pull on-demand de todas as entidades +
 * reconciliação de tarefas (Auvo → OS aberta). Não substitui o refresh por página, que continua
 * lendo cache local; este dispara chamadas reais ao Auvo. */
export interface SincronizarAuvoGateway {
  sincronizar(): Promise<SincronizacaoAuvoResultado>;
}
