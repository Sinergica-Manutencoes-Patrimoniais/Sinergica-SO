import { afterEach, expect, it, vi } from "vitest";
import { extrairXlsxEmWorker } from "./extrair-xlsx-worker";

class WorkerFalso {
  static instancia: WorkerFalso;
  onmessage: ((evento: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { WorkerFalso.instancia = this; }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("retorna dados válidos e encerra worker sem destacar bytes originais", async () => {
  vi.stubGlobal("Worker", WorkerFalso);
  const entrada = new Uint8Array([1, 2, 3]);
  const promessa = extrairXlsxEmWorker(entrada);
  WorkerFalso.instancia.onmessage?.({ data: { ok: true, partes: [["xl/workbook.xml", new Uint8Array([42]).buffer]] } });
  expect((await promessa).get("xl/workbook.xml")).toEqual(new Uint8Array([42]));
  expect(entrada).toEqual(new Uint8Array([1, 2, 3]));
  expect(WorkerFalso.instancia.terminate).toHaveBeenCalledOnce();
});
it("interrompe worker quando o prazo expira", async () => {
  vi.stubGlobal("Worker", WorkerFalso); vi.useFakeTimers();
  const promessa = extrairXlsxEmWorker(new Uint8Array([1]));
  const rejeicao = expect(promessa).rejects.toThrow("Tempo limite");
  await vi.advanceTimersByTimeAsync(10_000);
  await rejeicao;
  expect(WorkerFalso.instancia.terminate).toHaveBeenCalledOnce();
});
it("cancela worker sem devolver resposta tardia", async () => {
  vi.stubGlobal("Worker", WorkerFalso);
  const controle = new AbortController();
  const promessa = extrairXlsxEmWorker(new Uint8Array([1]), controle.signal);
  controle.abort();
  await expect(promessa).rejects.toThrow();
  expect(WorkerFalso.instancia.terminate).toHaveBeenCalledOnce();
});
it("rejeita resposta malformada ou duplicada", async () => {
  vi.stubGlobal("Worker", WorkerFalso);
  const promessa = extrairXlsxEmWorker(new Uint8Array([1]));
  WorkerFalso.instancia.onmessage?.({ data: { ok: true, partes: [["xl/a.xml", new ArrayBuffer(1)], ["xl/a.xml", new ArrayBuffer(1)]] } });
  await expect(promessa).rejects.toThrow();
  expect(WorkerFalso.instancia.terminate).toHaveBeenCalledOnce();
});
