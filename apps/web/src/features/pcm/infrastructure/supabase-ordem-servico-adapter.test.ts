import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ limit: vi.fn(), schema: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: mocks.schema } }));
import { supabaseOrdemServicoAdapter } from "./supabase-ordem-servico-adapter";

beforeEach(() => {
  mocks.limit.mockReset();
  mocks.schema.mockReturnValue({
    from: () => ({ select: () => ({ eq: () => ({ is: () => ({ limit: mocks.limit }) }) }) }),
  });
});
it("mantém compatibilidade para nenhuma e uma OS", async () => {
  mocks.limit
    .mockResolvedValueOnce({ data: [], error: null })
    .mockResolvedValueOnce({ data: [{ id: "os-1", numero: "OS-1" }], error: null });
  expect(await supabaseOrdemServicoAdapter.obterPorChamado?.("ch-1")).toBeNull();
  expect(await supabaseOrdemServicoAdapter.obterPorChamado?.("ch-1")).toEqual({
    id: "os-1",
    numero: "OS-1",
  });
  expect(mocks.limit).toHaveBeenCalledWith(2);
});
it("não escolhe arbitrariamente uma OS se o Chamado tiver mais de uma", async () => {
  mocks.limit.mockResolvedValue({
    data: [
      { id: "os-1", numero: "OS-1" },
      { id: "os-2", numero: "OS-2" },
    ],
    error: null,
  });
  await expect(supabaseOrdemServicoAdapter.obterPorChamado?.("ch-1")).rejects.toThrow(
    "mais de uma OS",
  );
});
