import { DOMParser as XmlDomParser } from "npm:@xmldom/xmldom@0.9.12";
import { processarXlsxCronograma } from "../../../../apps/web/src/features/pcm/application/processar-xlsx-cronograma.ts";

const parser = { parseFromString(xml: string, tipo: string) { return new XmlDomParser({ onError: (_nivel, mensagem) => { throw new Error(mensagem); } }).parseFromString(xml, tipo); } };
const escopo = globalThis as unknown as { onmessage: ((evento: MessageEvent<{ bytes: ArrayBuffer; fonteId: string; clienteId: string }>) => void) | null; postMessage: (mensagem: unknown) => void };
escopo.onmessage = async (evento) => {
  try {
    const resultado = await processarXlsxCronograma(new Uint8Array(evento.data.bytes), evento.data.fonteId, evento.data.clienteId, parser as unknown as Pick<DOMParser, "parseFromString">);
    escopo.postMessage({ ok: true, resultado });
  } catch {
    escopo.postMessage({ ok: false });
  }
};
