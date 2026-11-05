export type ExtratorXlsx = (
  entrada: Uint8Array,
  signal?: AbortSignal,
) => Promise<Map<string, Uint8Array>>;
