import { extrairXlsxLimitado } from "./extrair-xlsx-limitado";

const escopo = self as unknown as { onmessage: ((e: MessageEvent<unknown>) => void) | null; postMessage: (valor: unknown, transfer: Transferable[]) => void };
escopo.onmessage = (evento) => {
  const dados = evento.data;
  if (!(dados instanceof ArrayBuffer)) { escopo.postMessage({ ok: false }, []); return; }
  void extrairXlsxLimitado(new Uint8Array(dados)).then((partes) => {
    const saida = Array.from(partes, ([nome, bytes]) => [nome, bytes.buffer] as const);
    escopo.postMessage({ ok: true, partes: saida }, saida.map(([, bytes]) => bytes as ArrayBuffer));
  }).catch(() => escopo.postMessage({ ok: false }, []));
};
