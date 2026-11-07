import { describe, expect, it, vi } from "vitest";
import { enviarXlsxComRetomada } from "./enviar-xlsx-com-retomada";

const entrada = { userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", clienteId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", fonteId: "Rimini", bytes: new Uint8Array([1, 2, 3]) };
const ausente = async () => ({ estado: "ausente" as const });
function memoria() { const dados = new Map<string, string>(); return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => { dados.set(k, v); }, dados }; }
describe("retomada de recepção XLSX", () => {
  it("mantém pedido e lote depois de falha incerta e recarga", async () => {
    const storage = memoria(); const recebidos: Array<{ requestId: string; loteId: string }> = [];
    const enviar = vi.fn(async (p) => { recebidos.push(p); if (recebidos.length === 1) throw new Error("rede"); return { revision: 1, created: true }; });
    await expect(enviarXlsxComRetomada(entrada, storage, enviar, ausente)).rejects.toThrow();
    await expect(enviarXlsxComRetomada(entrada, storage, enviar, ausente)).resolves.toMatchObject({ revision: 1, created: true });
    expect(recebidos[0]?.requestId).toBe(recebidos[1]?.requestId);
    expect(recebidos[0]?.loteId).toBe(recebidos[1]?.loteId);
    expect(JSON.stringify([...storage.dados.values()])).not.toContain("1,2,3");
  });
  it("não substitui tentativa incerta por arquivo diferente", async () => {
    const storage = memoria(); const enviar = vi.fn().mockRejectedValue(new Error("rede"));
    await expect(enviarXlsxComRetomada(entrada, storage, enviar, ausente)).rejects.toThrow();
    await expect(enviarXlsxComRetomada({ ...entrada, bytes: new Uint8Array([4]) }, storage, enviar, ausente)).rejects.toThrow("outra tentativa");
    expect(enviar).toHaveBeenCalledTimes(1);
  });
  it("não envia se armazenamento não confirma gravação", async () => {
    const enviar = vi.fn(); const storage = { getItem: () => null, setItem: () => {} };
    await expect(enviarXlsxComRetomada(entrada, storage, enviar, ausente)).rejects.toThrow();
    expect(enviar).not.toHaveBeenCalled();
  });
  it("reconfirma no servidor com os mesmos IDs depois de um recibo", async () => {
    const storage = memoria(); const enviar = vi.fn().mockResolvedValue({ revision: 2, created: false });
    const primeiro = await enviarXlsxComRetomada(entrada, storage, enviar, ausente);
    expect(await enviarXlsxComRetomada(entrada, storage, enviar, ausente)).toEqual(primeiro);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0]![0].requestId).toBe(enviar.mock.calls[1]![0].requestId);
  });
  it("após perder IDs locais, usa lote de mesma origem e arquivo encontrado no servidor", async () => {
    const storage = memoria(); const enviar = vi.fn().mockResolvedValue({ revision: 1, created: false });
    const recuperar = vi.fn().mockResolvedValue({ estado: "encontrada", loteId: "cccccccc-cccc-cccc-cccc-cccccccccccc", revisao: 1, sha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81" });
    await enviarXlsxComRetomada(entrada, storage, enviar, recuperar);
    expect(enviar.mock.calls[0]![0].loteId).toBe("cccccccc-cccc-cccc-cccc-cccccccccccc");
  });
  it("não envia quando origem existente exige reconciliação ou tem outro arquivo", async () => {
    for (const estado of [{ estado: "reconciliacao" as const }, { estado: "encontrada" as const, loteId: "cccccccc-cccc-cccc-cccc-cccccccccccc", revisao: 1, sha256: "a".repeat(64) }]) {
      const enviar = vi.fn();
      await expect(enviarXlsxComRetomada(entrada, memoria(), enviar, async () => estado)).rejects.toThrow();
      expect(enviar).not.toHaveBeenCalled();
    }
  });
  it("aceita origem com acentos preservando-a na tentativa e na chamada", async () => {
    const storage = memoria(); const enviar = vi.fn().mockResolvedValue({ revision: 1, created: true });
    await enviarXlsxComRetomada({ ...entrada, fonteId: "São João — Torre A" }, storage, enviar, ausente);
    expect(enviar.mock.calls[0]![0].fonteId).toBe("São João — Torre A");
    expect([...storage.dados.keys()][0]).toContain("São João — Torre A");
  });
  it("recusa caractere de controle e Unicode incompleto antes de consultar ou enviar", async () => {
    for (const fonteId of ["A\u0000B", "A\ud800B"]) {
      const enviar = vi.fn(); const recuperar = vi.fn();
      await expect(enviarXlsxComRetomada({ ...entrada, fonteId }, memoria(), enviar, recuperar)).rejects.toThrow();
      expect(enviar).not.toHaveBeenCalled(); expect(recuperar).not.toHaveBeenCalled();
    }
  });
});
