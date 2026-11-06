import { expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  schema: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: api.schema } }));
import { supabaseEquipamentosAdapter } from "./supabase-equipamentos-adapter";

it("traz revisão estrutural do servidor para evitar edição obsoleta", async () => {
  api.schema.mockReturnValue({ from: api.from });
  api.from.mockReturnValue({ select: api.select });
  api.select.mockReturnValue({ eq: api.eq });
  api.eq.mockReturnValue({ maybeSingle: api.maybeSingle });
  api.maybeSingle.mockResolvedValue({
    data: {
      id: "item",
      nome: "Bomba",
      client_id: null,
      estrutura_revisao: 7,
      uri_anexos: [],
      tipo: "componente",
    },
    error: null,
  });
  const item = await supabaseEquipamentosAdapter.obterItem("item");
  expect(item?.estruturaRevisao).toBe(7);
});
