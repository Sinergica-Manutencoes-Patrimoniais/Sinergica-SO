const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v22.0";

/** Erro de Graph com o código da Meta preservado — quem chama precisa distinguir "fora da janela
 * de 24 h" (definitivo, não adianta repetir) de falha transitória. */
export class MetaGraphError extends Error {
  constructor(
    readonly status: number,
    readonly codigo: number | null,
    readonly subcodigo: number | null,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "MetaGraphError";
  }

  /** `code 10 / subcode 2534022`: a janela de 24 h do Direct fechou. */
  get foraDaJanela(): boolean {
    return this.codigo === 10 && this.subcodigo === 2534022;
  }
}

/** Chamada ao Graph com o token DAQUELE canal, lido do Vault pelo chamador. Nenhuma credencial
 * global participa (ADR-1700). `redirect: 'error'` para o Graph nunca nos levar a outra origem. */
export async function metaRequestComToken(
  token: string,
  path: string,
  init: RequestInit = {},
  graphVersion: string = GRAPH_VERSION,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  if (!token.trim()) throw new Error("token_do_canal_ausente");
  if (!/^v[0-9]+\.[0-9]+$/.test(graphVersion)) throw new Error("graph_version_invalida");
  const response = await fetchImpl(`https://graph.facebook.com/${graphVersion}/${path}`, {
    ...init,
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const erro = (body.error ?? {}) as Record<string, unknown>;
    throw new MetaGraphError(
      response.status,
      typeof erro.code === "number" ? erro.code : null,
      typeof erro.error_subcode === "number" ? erro.error_subcode : null,
      `Meta Graph respondeu ${response.status}`,
    );
  }
  return body;
}

/** Resposta de Instagram Direct / Messenger: `{conta}/messages` com `recipient.id` = IGSID.
 * Texto puro — o Direct não aceita anexo por este caminho. */
export async function enviarDirectMeta(
  token: string,
  contaId: string,
  destinatario: string,
  texto: string,
  graphVersion?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const body = await metaRequestComToken(
    token,
    `${encodeURIComponent(contaId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ recipient: { id: destinatario }, message: { text: texto } }),
    },
    graphVersion,
    fetchImpl,
  );
  return typeof body.message_id === "string" ? body.message_id : null;
}

/** LEGADO (E02-S16 original): usa `META_ACCESS_TOKEN` global. Continua servindo o WhatsApp Cloud
 * (templates e envio rico) até aquele caminho migrar para credencial por canal — débito registrado
 * em docs/SECURITY_DEBT.md. Instagram Direct NÃO passa por aqui. */
export async function metaRequest(
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const token = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  if (!token) throw new Error("META_ACCESS_TOKEN ausente");
  return metaRequestComToken(token, path, init);
}

export async function enviarMeta(
  tipo: "meta_wa" | "instagram" | "messenger",
  accountId: string,
  recipientId: string,
  text: string,
): Promise<void> {
  if (tipo === "meta_wa") {
    await metaRequest(`${encodeURIComponent(accountId)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientId.replace(/\D/g, ""),
        type: "text",
        text: { body: text },
      }),
    });
    return;
  }
  await metaRequest(`${encodeURIComponent(accountId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
}
