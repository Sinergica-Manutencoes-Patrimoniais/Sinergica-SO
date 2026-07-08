// _shared/evolution.ts — E02-S01. Extraído de `pcm-ze-agent/index.ts` (função `responderEvolution`,
// idêntica, comportamento preservado) para ser reusado também por `atendimento-whatsapp-envio`
// (envio humano) — nenhuma das duas duplica mais a chamada HTTP ao Evolution.

export async function responderEvolution(instanceId: string, remoteJid: string, text: string): Promise<void> {
  await enviarEvolution(instanceId, "sendText", { number: remoteJid, text });
}

export async function enviarEvolution(
  instanceId: string,
  endpoint: "sendText" | "sendMedia" | "sendTemplate" | "sendButtons",
  payload: Record<string, unknown>,
): Promise<void> {
  await chamarEvolution(instanceId, endpoint, payload);
}

async function chamarEvolution(
  instanceId: string,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL") ?? "";
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
  if (!baseUrl || !apiKey) throw new Error("EVOLUTION_API_URL/EVOLUTION_API_KEY ausentes");
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${normalizedBase}/message/${endpoint}/${encodeURIComponent(instanceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Evolution ${endpoint} falhou: ${res.status}`);
}
