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

// E00-S28 AC-7 — o front recebe erro de RPC Postgres (PostgrestError.code), não status HTTP. Hoje
// cada um dos 434 arquivos que leem flag `VITE_SSO_*` repete seu próprio `if (codigo === "42501")`
// (ver AcoesVisita.tsx, FormularioRotina.tsx…). Esta função é o ponto único que distingue as duas
// causas que hoje chegam como o mesmo erro genérico:
//   - 42501 (RLS/grant) → falta de PERMISSÃO — o usuário não pode, ponto.
//   - 55000 (gate de banco fechado por padrão, convenção deste repositório) → recurso NÃO ATIVADO
//     — existe, está desligado; vira `RecursoNaoAtivado`, não um erro de permissão.
export type CausaErroRpc = "permissao" | "nao_ativado" | "outro";

export function causaErroRpc(codigo: string | undefined | null): CausaErroRpc {
  if (codigo === "42501") return "permissao";
  if (codigo === "55000") return "nao_ativado";
  return "outro";
}

/** Mensagem segura por causa — mesmo texto em todo o front, em vez de reimplementado por tela. */
export function mensagemErroRpc(codigo: string | undefined | null): string {
  const causa = causaErroRpc(codigo);
  if (causa === "permissao") return "Você não tem permissão para esta ação.";
  if (causa === "nao_ativado") return "Este recurso ainda não está ativado para a sua operação.";
  return "Não foi possível concluir a operação. Tente novamente ou procure suporte.";
}
