import type { AuvoEntityDescriptor } from "./registry/types.ts";

export const AUVO_ACTION_INCLUSAO = 1;
export const AUVO_ACTION_ALTERACAO = 2;
export const AUVO_ACTION_EXCLUSAO = 3;

export type WebhookDispatchDecision<TRow extends Record<string, unknown> = Record<string, unknown>> =
  | { action: "ignore"; reason: string }
  | { action: "upsert"; auvoId: number | string; patch: Partial<TRow> }
  | { action: "soft-delete"; auvoId: number | string; patch: Partial<TRow> };

export function resolveWebhookDispatch<TAuvo, TRow extends Record<string, unknown>>(
  event: Record<string, unknown>,
  descriptor: AuvoEntityDescriptor<TAuvo, TRow> | undefined,
): WebhookDispatchDecision<TRow> {
  if (!descriptor) return { action: "ignore", reason: "descriptor_not_found" };
  if (!descriptor.writeEnabled) return { action: "ignore", reason: "write_disabled" };

  const auvoId = extractAuvoId(event);
  if (auvoId == null) return { action: "ignore", reason: "auvo_id_not_found" };

  if (event.action === AUVO_ACTION_EXCLUSAO) {
    return {
      action: "soft-delete",
      auvoId,
      patch: {
        auvo_id: auvoId,
        ativo: false,
        deleted_at: new Date().toISOString(),
      } as unknown as Partial<TRow>,
    };
  }

  if (event.action === AUVO_ACTION_INCLUSAO || event.action === AUVO_ACTION_ALTERACAO) {
    const payload = extractPayload<TAuvo>(event);
    return {
      action: "upsert",
      auvoId,
      patch: {
        ...descriptor.fromAuvo(payload),
        auvo_id: auvoId,
        auvo_sync_status: "synced",
        auvo_sync_error: null,
        auvo_synced_at: new Date().toISOString(),
      } as Partial<TRow>,
    };
  }

  return { action: "ignore", reason: "unsupported_action" };
}

function extractPayload<TAuvo>(event: Record<string, unknown>): TAuvo {
  const payload = event.payload ?? event.data ?? event.result ?? event;
  return payload as TAuvo;
}

export function extractAuvoId(event: Record<string, unknown>): number | string | null {
  const payload = event.payload ?? event.data ?? event.result;
  const candidates = [
    event.id,
    event.entityId,
    event.objectId,
    event.auvoId,
    valueAtPath(payload, ["id"]),
    valueAtPath(payload, ["entityId"]),
    valueAtPath(payload, ["userID"]),
    valueAtPath(payload, ["customerId"]),
    valueAtPath(payload, ["equipmentId"]),
    valueAtPath(payload, ["ticketId"]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return /^\d+$/.test(candidate) ? Number(candidate) : candidate;
    }
  }
  return null;
}

function valueAtPath(root: unknown, path: string[]): unknown {
  let current = root;
  for (const part of path) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
