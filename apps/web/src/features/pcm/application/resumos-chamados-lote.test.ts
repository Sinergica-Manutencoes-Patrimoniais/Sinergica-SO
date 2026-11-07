import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({
  supabase: { schema: () => ({ rpc: mocks.rpc }) },
}));
import { carregarResumosChamados } from "./resumos-chamados-lote";

beforeEach(() => mocks.rpc.mockReset());
it("agrupa até 100 Chamados por chamada sem inventar os que não retornaram", async () => {
  mocks.rpc.mockImplementation((_nome, args) => ({
    abortSignal: async () => ({
      data: [{ chamado_id: args.p_ids[0], total: 2, finalizadas: 1, etapas_mistas: true }],
      error: null,
    }),
  }));
  const ids = Array.from({ length: 101 }, (_, i) => `chamado-${i}`);
  const dados = await carregarResumosChamados(ids, new AbortController().signal);
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
  expect(dados["chamado-0"]).toEqual({ total: 2, finalizadas: 1, etapasMistas: true });
  expect(dados["chamado-1"]).toBeUndefined();
});
it("descarta o lote inteiro quando resposta é inconsistente", async () => {
  mocks.rpc.mockReturnValue({
    abortSignal: async () => ({
      data: [{ chamado_id: "fora", total: 1, finalizadas: 2, etapas_mistas: false }],
      error: null,
    }),
  });
  await expect(carregarResumosChamados(["a"], new AbortController().signal)).rejects.toThrow(
    "Resumo inválido",
  );
});
