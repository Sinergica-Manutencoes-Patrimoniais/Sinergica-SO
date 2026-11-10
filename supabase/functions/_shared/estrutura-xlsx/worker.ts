import { processarEstruturaXlsx } from "./processar.ts";

const escopo = globalThis as unknown as { onmessage: ((evento: MessageEvent<unknown>) => void) | null; postMessage: (valor: unknown) => void };
escopo.onmessage = (evento) => {
  const entrada = evento.data as { bytes?: unknown; aba?: unknown } | null;
  if (!entrada || !(entrada.bytes instanceof ArrayBuffer) || typeof entrada.aba !== "string") { escopo.postMessage({ ok: false }); return; }
  void processarEstruturaXlsx(new Uint8Array(entrada.bytes), entrada.aba)
    .then((resultado) => escopo.postMessage({ ok: true, resultado }))
    .catch(() => escopo.postMessage({ ok: false }));
};
