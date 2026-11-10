import { expect, it, vi } from "vitest";
import { enviarXlsxEntreAbas } from "./enviar-xlsx-entre-abas";

const entrada = { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", clienteId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", fonteId: "Rimini", bytes: new Uint8Array([1, 2, 3]) };
const ausente = async () => ({ estado: "ausente" as const });
function memoria() { const dados = new Map<string, string>(); return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => { dados.set(k, v); } }; }
function trava() {
  let fila = Promise.resolve();
  return { request<T>(_nome: string, callback: () => Promise<T>): Promise<T> {
    const proximo = fila.then(callback); fila = proximo.then(() => undefined, () => undefined); return proximo;
  } };
}
it("serializa tentativas simultâneas e reutiliza IDs entre abas", async () => {
  const storage = memoria(); const locks = trava();
  let liberar!: () => void;
  const enviados: Array<{ requestId: string; loteId: string }> = [];
  const enviar = vi.fn(async (p) => { enviados.push(p); if (enviados.length === 1) await new Promise<void>((resolve) => { liberar = resolve; }); return { revision: 1, created: enviados.length === 1 }; });
  const a = enviarXlsxEntreAbas(entrada, storage, locks, enviar, ausente);
  const b = enviarXlsxEntreAbas(entrada, storage, locks, enviar, ausente);
  await vi.waitFor(() => expect(enviados).toHaveLength(1));
  liberar(); await Promise.all([a, b]);
  expect(enviados).toHaveLength(2);
  expect(enviados[0]?.requestId).toBe(enviados[1]?.requestId);
  expect(enviados[0]?.loteId).toBe(enviados[1]?.loteId);
});
it("sem trava compartilhada não inicia envio", async () => {
  const enviar = vi.fn();
  await expect(enviarXlsxEntreAbas(entrada, memoria(), null, enviar, ausente)).rejects.toThrow(/coordenação/i);
  expect(enviar).not.toHaveBeenCalled();
});
