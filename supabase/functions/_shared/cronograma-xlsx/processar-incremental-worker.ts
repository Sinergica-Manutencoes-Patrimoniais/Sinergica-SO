import { processarXlsxIncrementalExperimental } from "./processar-incremental-experimental.ts";

// Protocolo idêntico ao leitor isolado; erros não expõem conteúdo do arquivo.
const escopo = globalThis as unknown as {
  onmessage: ((evento: MessageEvent<{ bytes: ArrayBuffer; fonteId: string; clienteId: string }>) => void) | null;
  postMessage: (mensagem: unknown) => void;
};
escopo.onmessage = async (evento) => {
  try {
    const resultado = await processarXlsxIncrementalExperimental(new Uint8Array(evento.data.bytes), evento.data.fonteId, evento.data.clienteId);
    escopo.postMessage({ ok: true, resultado });
  } catch {
    escopo.postMessage({ ok: false });
  }
};
