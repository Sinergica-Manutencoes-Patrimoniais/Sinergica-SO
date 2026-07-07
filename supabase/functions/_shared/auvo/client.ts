// _shared/auvo/client.ts — cliente HTTP Auvo compartilhado (Deno / Edge Function).
// Login cacheado em memória do processo (expira 120s antes do `expiration` real devolvido pelo
// Auvo — margem de segurança contra latência de rede/relógio), retry automático de 401 (token
// expirado, 1x), backoff simples em 429 (rate limit, 1x). Log estruturado com `X-Request-Id` +
// timestamp UTC em toda chamada (sucesso ou falha) — dado que o suporte Auvo pede em incidente.
// Ver specs/E01-S09-integracao-auvo-fundacao/design.md → Componentes (1) e Observabilidade.
//
// Sem SDK oficial do Auvo (confirmado no mapeamento) — usa fetch nativo do Deno, sem dependência
// de terceiros.
//
// NÃO VERIFICADO NESTE AMBIENTE: os nomes exatos de campo da resposta do Auvo (`result.accessToken`,
// `result.expiration`, formato de `paramFilter`) seguem a descrição textual de
// `docs/blueprint/integracoes/auvo.md` e `design.md` (que citam `Auvo-API-Mapeamento-Completo.md`,
// vault Obsidian não acessível aqui). Confirmar contra o mapeamento real / uma chamada de teste
// antes do primeiro deploy em produção — não há Deno CLI neste ambiente para exercitar a chamada.

const AUVO_BASE_URL = "https://api.auvo.com.br/v2";

/** Margem de segurança: renova o token 120s antes do `expiration` real (ver design.md). */
const TOKEN_EXPIRY_MARGIN_MS = 120_000;

/** Backoff simples ao levar 429 — 1 retry, 1s de espera (volume baixo, sem fila nesta fase). */
const RATE_LIMIT_BACKOFF_MS = 1_000;

interface AuvoLoginResult {
  accessToken: string;
  expiration: string; // ISO datetime devolvido pelo Auvo
}

/** Cache em memória do processo — válido enquanto a Edge Function estiver "quente" (mesma
 * instância Deno). Cada cold start refaz login; é o comportamento esperado (produto.md: volume
 * baixo, sem necessidade de cache persistente nesta fase). */
let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

export class AuvoApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
  ) {
    super(message);
  }
}

function logAuvoCall(params: {
  method: string;
  path: string;
  status?: number;
  requestId?: string | null;
  ok: boolean;
  detail?: string;
}): void {
  const linha = {
    ts: new Date().toISOString(), // UTC — Date#toISOString sempre em UTC
    nivel: params.ok ? "info" : "error",
    escopo: "auvo-client",
    method: params.method,
    path: params.path,
    status: params.status,
    requestId: params.requestId ?? null,
    detail: params.detail,
  };
  if (params.ok) {
    console.log(JSON.stringify(linha));
  } else {
    console.error(JSON.stringify(linha));
  }
}

function invalidateToken(): void {
  cachedToken = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Faz login no Auvo. Lança AuvoApiError se as credenciais estiverem ausentes ou a chamada falhar. */
async function login(): Promise<string> {
  const apiKey = Deno.env.get("AUVO_API_KEY") ?? "";
  const userToken = Deno.env.get("AUVO_USER_TOKEN") ?? "";
  if (!apiKey || !userToken) {
    throw new AuvoApiError(500, "AUVO_API_KEY/AUVO_USER_TOKEN ausentes no ambiente da Edge Function");
  }

  const url = `${AUVO_BASE_URL}/login?apiKey=${encodeURIComponent(apiKey)}&apiToken=${encodeURIComponent(userToken)}`;
  const res = await fetch(url, { method: "GET" });
  const requestId = res.headers.get("X-Request-Id");
  logAuvoCall({ method: "GET", path: "/login", status: res.status, requestId, ok: res.ok });

  if (!res.ok) {
    throw new AuvoApiError(res.status, `Falha no login Auvo (status ${res.status})`, requestId ?? undefined);
  }

  const body = await res.json().catch(() => null);
  const result: AuvoLoginResult | undefined = body?.result;
  if (!result?.accessToken || !result?.expiration) {
    throw new AuvoApiError(502, "Resposta de login Auvo sem accessToken/expiration", requestId ?? undefined);
  }

  const expiresAtMs = Date.parse(result.expiration) - TOKEN_EXPIRY_MARGIN_MS;
  cachedToken = { accessToken: result.accessToken, expiresAtMs };
  return result.accessToken;
}

/** Retorna o token cacheado (ou renova via login se ausente/expirado). */
export async function auvoToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) {
    return cachedToken.accessToken;
  }
  return login();
}

interface AuvoRequestState {
  retriedOn401?: boolean;
  retriedOn429?: boolean;
}

async function auvoRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  state: AuvoRequestState = {},
): Promise<T> {
  const token = await auvoToken();
  const res = await fetch(`${AUVO_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const requestId = res.headers.get("X-Request-Id");

  // 401: token expirado/revogado no meio da chamada — invalida cache, faz login de novo, 1 retry.
  if (res.status === 401 && !state.retriedOn401) {
    logAuvoCall({ method, path, status: res.status, requestId, ok: false, detail: "401 — retry com novo login" });
    invalidateToken();
    return auvoRequest<T>(method, path, body, { ...state, retriedOn401: true });
  }

  // 429: rate limit — 1 retry com backoff simples.
  if (res.status === 429 && !state.retriedOn429) {
    logAuvoCall({ method, path, status: res.status, requestId, ok: false, detail: "429 — retry com backoff" });
    await sleep(RATE_LIMIT_BACKOFF_MS);
    return auvoRequest<T>(method, path, body, { ...state, retriedOn429: true });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logAuvoCall({ method, path, status: res.status, requestId, ok: false, detail });
    throw new AuvoApiError(res.status, `Auvo ${method} ${path} falhou (status ${res.status})`, requestId ?? undefined);
  }

  logAuvoCall({ method, path, status: res.status, requestId, ok: true });

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function auvoGet<T>(path: string): Promise<T> {
  return auvoRequest<T>("GET", path, undefined);
}

export function auvoPost<T>(path: string, body: unknown): Promise<T> {
  return auvoRequest<T>("POST", path, body);
}

export function auvoPut<T>(path: string, body: unknown): Promise<T> {
  return auvoRequest<T>("PUT", path, body);
}

/** PATCH parcial — usado pelo motor de sync (E01-S22) para update de entidades já existentes no
 * Auvo (evita reenviar o payload inteiro de `POST`/`PUT`) e para soft-delete (`{ active: false }`,
 * decisão do usuário: delete no PCM nunca vira DELETE físico no Auvo). */
export function auvoPatch<T>(path: string, body: unknown): Promise<T> {
  return auvoRequest<T>("PATCH", path, body);
}

/** DELETE físico — implementado por completude de contrato do cliente HTTP, mas nenhum descriptor
 * do motor de sync (E01-S22+) o invoca ainda: a política vigente é soft-delete → `auvoPatch` com
 * `active:false` (ver design.md → Non-goals). Reservado para um fluxo futuro de hard-delete atrás
 * de superadmin + confirmação explícita. */
export function auvoDelete<T>(path: string): Promise<T> {
  return auvoRequest<T>("DELETE", path, undefined);
}

/** Monta o querystring `paramFilter` (JSON-encoded) usado pelos endpoints de busca do Auvo v2
 * (ex.: `GET /customers?paramFilter=...`, `GET /tasks?paramFilter=...`). Ver design.md → Contrato
 * dos dados trocados. Formato exato do filtro NÃO VERIFICADO neste ambiente (ver nota no topo). */
export function buildParamFilter(filter: Record<string, unknown>): string {
  return `paramFilter=${encodeURIComponent(JSON.stringify(filter))}`;
}
