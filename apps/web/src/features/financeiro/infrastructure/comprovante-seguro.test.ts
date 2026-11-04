import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ download: vi.fn(), createSignedUrl: vi.fn() }));
const functions = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { storage: { from: () => storage }, functions },
}));
import { supabaseFinanceiroAdapter } from "./supabase-financeiro-adapter";

describe("comprovante privado", () => {
  beforeEach(() => vi.resetAllMocks());
  it("obtém conteúdo por requisição autenticada sem criar URL compartilhável", async () => {
    const arquivo = new Blob(["conteúdo"]);
    const lancamentoId = "18410000-0000-4000-8000-000000000012";
    functions.invoke.mockResolvedValue({ data: arquivo, error: null });
    expect(await supabaseFinanceiroAdapter.baixarComprovante(lancamentoId)).toBe(
      arquivo,
    );
    expect(functions.invoke).toHaveBeenCalledWith("financeiro-comprovante-seguro", { body: { lancamentoId } });
    expect(storage.download).not.toHaveBeenCalled();
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
  it("propaga falha de autorização do armazenamento", async () => {
    functions.invoke.mockResolvedValue({ data: null, error: new Error("sem acesso") });
    await expect(supabaseFinanceiroAdapter.baixarComprovante("18410000-0000-4000-8000-000000000012")).rejects.toThrow(
      "sem acesso",
    );
    expect(storage.download).not.toHaveBeenCalled();
  });
  it("recusa resposta que não é arquivo", async () => {
    functions.invoke.mockResolvedValue({ data: { path: "privado.pdf" }, error: null });
    await expect(supabaseFinanceiroAdapter.baixarComprovante("18410000-0000-4000-8000-000000000012")).rejects.toThrow();
  });
});
