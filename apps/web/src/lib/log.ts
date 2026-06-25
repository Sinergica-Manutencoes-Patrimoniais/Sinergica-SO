// Logger estruturado (JSON) para a borda e a infraestrutura.
// Regras: uma linha JSON por evento; sempre com `reqId` quando houver; NUNCA logar PII
// (CPF, email, token, senha) nem o corpo cru de request. Ver observabilidade/README.md.
// O domínio (domain/) não loga — quem loga é interfaces/ e infrastructure/.

export type NivelLog = "debug" | "info" | "warn" | "error";

export interface CamposLog {
  /** Correlaciona todos os logs de uma mesma requisição. */
  reqId?: string;
  /** Campos extras seguros (sem PII). */
  [chave: string]: unknown;
}

/** Sink de saída — sobrescrevível em teste. Default: console. */
let sink: (linha: string) => void = (linha) => {
  process.stdout.write(`${linha}\n`);
};

/** Troca o destino do log (ex.: capturar em teste). Retorna o sink anterior. */
export function definirSink(novo: (linha: string) => void): (linha: string) => void {
  const anterior = sink;
  sink = novo;
  return anterior;
}

function emitir(nivel: NivelLog, msg: string, campos: CamposLog = {}): void {
  sink(JSON.stringify({ ts: new Date().toISOString(), nivel, msg, ...campos }));
}

export const log = {
  debug: (msg: string, campos?: CamposLog) => emitir("debug", msg, campos),
  info: (msg: string, campos?: CamposLog) => emitir("info", msg, campos),
  warn: (msg: string, campos?: CamposLog) => emitir("warn", msg, campos),
  error: (msg: string, campos?: CamposLog) => emitir("error", msg, campos),
};
