import { expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc: api.rpc }) } }));
import { consultarEscopo } from "./supabase-escopo-origem-adapter";

it("consulta escopo pela entrada serializada", async () => {
  api.rpc.mockReturnValue({ abortSignal: async () => ({ data: { osId: "os", revision: 0, executadoDeclarado: null, restanteDeclarado: null, execucaoComprovada: false, origem: { preparadaId: "origem" } }, error: null }) });
  await consultarEscopo("cliente", "os", new AbortController().signal);
  expect(api.rpc).toHaveBeenCalledWith("sso_consultar_escopo_autorizado", { p_cliente_id: "cliente", p_os_id: "os" });
});
