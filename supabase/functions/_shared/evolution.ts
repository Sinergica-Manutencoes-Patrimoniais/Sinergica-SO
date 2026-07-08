// _shared/evolution.ts — E02-S01. Extraído de `pcm-ze-agent/index.ts` (função `responderEvolution`,
// idêntica, comportamento preservado) para ser reusado também por `atendimento-whatsapp-envio`
// (envio humano) — nenhuma das duas duplica mais a chamada HTTP ao Evolution.

export async function responderEvolution(instanceId: string, remoteJid: string, text: string): Promise<void> {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL") ?? "";
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";
  if (!baseUrl || !apiKey) throw new Error("EVOLUTION_API_URL/EVOLUTION_API_KEY ausentes");
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${normalizedBase}/message/sendText/${encodeURIComponent(instanceId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: remoteJid, text }),
  });
  if (!res.ok) throw new Error(`Evolution sendText falhou: ${res.status}`);
}
