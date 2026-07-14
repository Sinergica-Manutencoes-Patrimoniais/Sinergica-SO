import type { SincronizacaoAuvoRun, SincronizarAuvoGateway } from "./sincronizar-auvo-gateway";

/** Minutos após os quais uma run "running" é considerada travada — a UI não retoma o
 * acompanhamento pra elas ao montar a página (evita polling eterno de um sync morto sem gravar
 * conclusão, ex.: crash do worker antes de chamar `finalizarRun`). */
const LIMITE_MINUTOS_RETOMAR = 10;

export function iniciarSincronizacaoAuvo(gateway: SincronizarAuvoGateway) {
  return gateway.iniciar();
}

export function consultarRunSincronizacaoAuvo(gateway: SincronizarAuvoGateway, runId: string) {
  return gateway.consultarRun(runId);
}

export function buscarUltimaRunSincronizacaoAuvo(gateway: SincronizarAuvoGateway) {
  return gateway.buscarUltimaRun();
}

/** Função pura (E01-S67 AC-7): decide se a página deve retomar o acompanhamento de uma run ao
 * montar — só quando ainda está `running` e começou há pouco tempo. */
export function deveRetomarAcompanhamento(run: SincronizacaoAuvoRun | null, agora: Date): boolean {
  if (!run || run.status !== "running") return false;
  const minutosDecorridos = (agora.getTime() - new Date(run.startedAt).getTime()) / 60_000;
  return minutosDecorridos < LIMITE_MINUTOS_RETOMAR;
}
