const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v22.0";

export async function metaRequest(
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const token = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  if (!token) throw new Error("META_ACCESS_TOKEN ausente");
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Meta Graph respondeu ${response.status}`);
  return body;
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
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
}
