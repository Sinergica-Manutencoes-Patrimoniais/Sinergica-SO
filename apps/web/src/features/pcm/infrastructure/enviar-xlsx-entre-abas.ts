import { enviarXlsxComRetomada, type RecuperacaoXlsx } from "./enviar-xlsx-com-retomada";

type Entrada = { userId: string; clienteId: string; fonteId: string; bytes: Uint8Array };
type Pedido = Entrada & { requestId: string; loteId: string };
type Recibo = { revision: number; created: boolean };
type Travas = { request<T>(nome: string, callback: () => Promise<T>): Promise<T> };

/** Exige armazenamento compartilhado e trava do navegador; não coordena dispositivos. */
export async function enviarXlsxEntreAbas(entrada: Entrada, storage: Pick<Storage, "getItem" | "setItem">, locks: Travas | null, enviar: (pedido: Pedido) => Promise<Recibo>, recuperar: () => Promise<RecuperacaoXlsx>): Promise<Recibo> {
  if (!locks || typeof locks.request !== "function") throw new Error("Coordenação entre abas indisponível.");
  const copia = { ...entrada, bytes: Uint8Array.from(entrada.bytes) };
  const nome = `sso:xlsx:v1:${JSON.stringify([copia.userId, copia.clienteId, copia.fonteId])}`;
  return locks.request(nome, () => enviarXlsxComRetomada(copia, storage, enviar, recuperar));
}
