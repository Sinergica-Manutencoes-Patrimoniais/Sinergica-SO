export interface SincronizacaoAuvoEtapa {
  step: string;
  ok: boolean;
  error?: string;
}

export type SincronizacaoAuvoStatus = "running" | "succeeded" | "failed";

export interface SincronizacaoAuvoRun {
  id: string;
  status: SincronizacaoAuvoStatus;
  ok: boolean | null;
  etapas: SincronizacaoAuvoEtapa[];
  startedAt: string;
  finishedAt: string | null;
}

/** Porta do botão global "Sincronizar Auvo" (E01-S37). Pull on-demand de todas as entidades +
 * reconciliação de tarefas (Auvo → OS aberta) — não substitui o refresh por página, que continua
 * lendo cache local; este dispara chamadas reais ao Auvo.
 *
 * E01-S67: execução em background — `iniciar` só dispara e devolve o id da execução; o progresso
 * é acompanhado via `consultarRun` (polling) em vez de esperar uma resposta HTTP longa. O sync
 * continua no servidor mesmo se o usuário sair da página; `buscarUltimaRun` permite retomar o
 * acompanhamento ao voltar. */
export interface SincronizarAuvoGateway {
  iniciar(): Promise<{ runId: string }>;
  consultarRun(runId: string): Promise<SincronizacaoAuvoRun>;
  buscarUltimaRun(): Promise<SincronizacaoAuvoRun | null>;
}
