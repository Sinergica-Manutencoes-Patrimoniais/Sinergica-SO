// _shared/evolution.ts — E02-S01. Extraído de `pcm-ze-agent/index.ts` (função `responderEvolution`,
// idêntica, comportamento preservado) para ser reusado também por `atendimento-whatsapp-envio`
// (envio humano) — nenhuma das duas duplica mais a chamada HTTP ao Evolution.

export function criarPayloadTexto(remoteJid: string, text: string): Record<string, unknown> {
  const number = remoteJid.trim();
  const conteudo = text.trim();
  if (!number) throw new Error("Destinatário Evolution é obrigatório");
  if (!conteudo) throw new Error("Texto Evolution é obrigatório");
  // Evolution API 2.3+: `textMessage.text`, não o payload legado `{ text }`.
  return { number, textMessage: { text: conteudo } };
}

export async function responderEvolution(
  instanceId: string,
  remoteJid: string,
  text: string,
): Promise<void> {
  await enviarEvolution(instanceId, "sendText", criarPayloadTexto(remoteJid, text));
}

/** E04-S08: telefone de contato (`pcm.clientes.contato_telefone`, formatos livres — Auvo/cadastro
 * manual) → `remote_jid` do WhatsApp. Sem DDI (10/11 dígitos, DDD+número) assume Brasil (55). `null`
 * se não sobrar dígito suficiente pra ser um número válido — chamador decide como degradar. */
export function telefoneParaRemoteJid(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comDdi = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `${comDdi}@s.whatsapp.net`;
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
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Evolution ${endpoint} falhou: ${res.status}`);
}
