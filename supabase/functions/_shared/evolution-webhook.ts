export interface EvolutionIncomingMessage {
  instanceId: string | null;
  remoteJid: string | null;
  senderJid: string | null;
  messageId: string | null;
  content: string | null;
  receivedAt: string | null;
  contactName: string | null;
  fromMe: boolean;
}

export function extractEvolutionMessage(
  payload: Record<string, unknown>,
): EvolutionIncomingMessage {
  const data = asObject(payload.data) ?? asObject(payload.message) ?? payload;
  const key = asObject(data.key);
  const message = asObject(data.message);
  const content =
    firstString([
      data.conversation,
      data.text,
      data.body,
      data.messageText,
      message?.conversation,
      asObject(message?.extendedTextMessage)?.text,
      asObject(message?.buttonsResponseMessage)?.selectedDisplayText,
      asObject(message?.buttonsResponseMessage)?.selectedButtonId,
      asObject(message?.listResponseMessage)?.title,
      asObject(asObject(message?.listResponseMessage)?.singleSelectReply)?.selectedRowId,
    ]) ?? "";
  return {
    instanceId: firstString([payload.instance, payload.instanceId, data.instanceId]),
    remoteJid: firstString([data.remoteJid, key?.remoteJid]),
    senderJid: firstString([data.sender, data.senderJid, key?.participant]),
    messageId: firstString([data.messageId, data.id, key?.id]),
    content,
    receivedAt: toIso(data.messageTimestamp ?? data.timestamp ?? payload.date_time),
    contactName: firstString([data.pushName, payload.pushName, data.notifyName]),
    fromMe: key?.fromMe === true || data.fromMe === true,
  };
}

export function normalizarEventoEvolution(event: string | undefined): string | null {
  if (!event?.trim()) return null;
  return event.trim().toLocaleLowerCase("en-US").replaceAll("_", ".");
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function toIso(value: unknown): string | null {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (typeof value === "number") {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}
