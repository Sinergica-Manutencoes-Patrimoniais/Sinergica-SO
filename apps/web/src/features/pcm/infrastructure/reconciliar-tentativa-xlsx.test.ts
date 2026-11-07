import { expect, it } from "vitest";
import { enviarXlsxEntreAbas } from "./enviar-xlsx-entre-abas";
import { reconciliarTentativaXlsx } from "./reconciliar-tentativa-xlsx";

const entrada = { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", clienteId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", fonteId: "Rimini", bytes: new Uint8Array([1, 2, 3]) };
const sha256 = "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";
const lote = "cccccccc-cccc-cccc-cccc-cccccccccccc";
function memoria() { const dados = new Map<string, string>(); return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => { dados.set(k, v); }, dados }; }
const locks = { request: async <T>(_nome: string, callback: () => Promise<T>) => callback() };
const ausente = async () => ({ estado: "ausente" as const });
it("reconcilia conflito confirmado com mesmo arquivo, preserva IDs anteriores e repete no lote correto", async () => {
  const storage = memoria(); let primeiro = ""; let loteOriginal = "";
  await expect(enviarXlsxEntreAbas(entrada, storage, locks, async (p) => { primeiro = p.requestId; loteOriginal = p.loteId; throw new Error("incerto"); }, ausente)).rejects.toThrow();
  await reconciliarTentativaXlsx(entrada, storage, locks, async () => ({ estado: "encontrada", loteId: lote, revisao: 1, sha256 }));
  let novoPedido = "";
  await enviarXlsxEntreAbas(entrada, storage, locks, async (p) => { novoPedido = p.requestId; expect(p.loteId).toBe(lote); return { revision: 1, created: false }; }, ausente);
  expect(novoPedido).not.toBe(primeiro);
  expect([...storage.dados.values()].join()).toContain(primeiro);
  expect([...storage.dados.values()].join()).toContain(loteOriginal);
});
it("sem origem encontrada ou com hash diferente, preserva a tentativa sem alteração", async () => {
  for (const resposta of [{ estado: "ausente" as const }, { estado: "encontrada" as const, loteId: lote, revisao: 1, sha256: "a".repeat(64) }]) {
    const storage = memoria();
    await expect(enviarXlsxEntreAbas(entrada, storage, locks, async () => { throw new Error("incerto"); }, ausente)).rejects.toThrow();
    const anterior = [...storage.dados.values()][0];
    await expect(reconciliarTentativaXlsx(entrada, storage, locks, async () => resposta)).rejects.toThrow();
    expect([...storage.dados.values()][0]).toBe(anterior);
  }
});
it("não altera armazenamento se outra tentativa o modificou durante consulta", async () => {
  const storage = memoria();
  await expect(enviarXlsxEntreAbas(entrada, storage, locks, async () => { throw new Error("incerto"); }, ausente)).rejects.toThrow();
  const chave = [...storage.dados.keys()][0]!;
  await expect(reconciliarTentativaXlsx(entrada, storage, locks, async () => { storage.setItem(chave, "substituida"); return { estado: "encontrada", loteId: lote, revisao: 1, sha256 }; })).rejects.toThrow();
  expect(storage.getItem(chave)).toBe("substituida");
});
it("mantém pedido original quando servidor identifica o mesmo lote", async () => {
  const storage = memoria(); let loteOriginal = "";
  await expect(enviarXlsxEntreAbas(entrada, storage, locks, async (p) => { loteOriginal = p.loteId; throw new Error("incerto"); }, ausente)).rejects.toThrow();
  const anterior = [...storage.dados.values()][0];
  await reconciliarTentativaXlsx(entrada, storage, locks, async () => ({ estado: "encontrada", loteId: loteOriginal, revisao: 1, sha256 }));
  expect([...storage.dados.values()][0]).toBe(anterior);
});
