import { expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
import { consultarEsforcoDeclarado } from "./supabase-esforco-declarado-adapter";

it.each(["os", "ocorrencia", "ocorrencia_visita"] as const)("consulta %s pela entrada serializada", async (tipo) => {
  api.rpc.mockReset();
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: { origemTipo: tipo, origemId: "origem", revision: 0, internosMinutos: null, terceirosMinutos: null, acompanhamentoMinutos: null }, error: null }) });
  await consultarEsforcoDeclarado("cliente", "origem", new AbortController().signal, tipo);
  expect(api.rpc).toHaveBeenCalledWith("sso_consultar_esforco_autorizado", { p_cliente_id: "cliente", p_origem_tipo: tipo, p_origem_id: "origem" });
});
