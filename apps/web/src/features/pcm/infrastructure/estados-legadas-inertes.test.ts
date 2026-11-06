import { afterEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../lib/supabase-client", () => ({ supabase: { schema: () => ({ rpc }) } }));
import { consultarEstadosLegadas } from "./estados-legadas-inertes";
afterEach(() => { vi.unstubAllEnvs(); rpc.mockReset(); });
describe("classificação legada", () => {
 it("consulta todos os IDs por Cliente em lotes limitados", async () => {
  vi.stubEnv("VITE_SSO_RECONCILIAR_LEGADA_INERTE_ENABLED", "true");
  rpc.mockImplementation(async (_nome, args) => ({ data: args.p_legadas.map((id: string) => ({ legada_id: id, estado: id === "1" ? "substituida" : "normal" })), error: null }));
  const ids=Array.from({length:101},(_,i)=>String(i)); const resultado=await consultarEstadosLegadas("cliente",ids);
  expect(rpc).toHaveBeenCalledTimes(2); expect(resultado.get("1")).toBe("substituida"); expect(resultado.size).toBe(101);
 });
 it("falha fechada diante de resposta parcial ou fora do Cliente consultado", async () => {
  vi.stubEnv("VITE_SSO_RECONCILIAR_LEGADA_INERTE_ENABLED", "true"); rpc.mockResolvedValue({data:[{legada_id:"outro",estado:"normal"}],error:null});
  await expect(consultarEstadosLegadas("cliente",["esperado"])).rejects.toThrow();
 });
});
