// Erros HTTP no formato RFC 7807 (problem+json). É a taxonomia única de erro da borda.
// Framework-agnóstico: produz um objeto serializável; quem emite a Response decide o transporte
// (Edge Function, Express, etc.). Erros NUNCA vazam stack trace nem detalhe interno ao cliente.
// Ver observabilidade/README.md (taxonomia de erro).

export const CONTENT_TYPE_PROBLEM = "application/problem+json";

export interface ProblemDetails {
  /** URI do tipo do problema; "about:blank" quando só o status importa. */
  type: string;
  /** Título curto e estável (não muda entre ocorrências do mesmo status). */
  title: string;
  status: number;
  /** Mensagem segura para o cliente — sem stack, sem dado interno. */
  detail?: string;
  /** Identificador da requisição para correlação com os logs. */
  reqId?: string;
}

const TITULOS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

/** Monta um ProblemDetails. `detail` deve ser seguro para o cliente (mensagem, não stack). */
export function problem(
  status: number,
  detail?: string,
  opts?: { reqId?: string; type?: string },
): ProblemDetails {
  return {
    type: opts?.type ?? "about:blank",
    title: TITULOS[status] ?? "Error",
    status,
    ...(detail ? { detail } : {}),
    ...(opts?.reqId ? { reqId: opts.reqId } : {}),
  };
}
