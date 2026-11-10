import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock("../../../lib/supabase-client",()=>({supabase:{functions:{invoke:mocks.invoke}}}));
import { baixarComprovanteDespesa } from "./supabase-despesas-visita-adapter";
const despesa="18090000-0000-4000-8000-000000000002";
afterEach(()=>{mocks.invoke.mockReset();vi.unstubAllEnvs();});
it("mantém rota legada quando flag está fechada",async()=>{mocks.invoke.mockResolvedValue({data:new Blob(["ok"]),error:null});await baixarComprovanteDespesa(despesa);expect(mocks.invoke).toHaveBeenCalledWith("despesa-visita-comprovante-seguro",{body:{lancamentoId:despesa}});});
it("usa seletor unificado e não faz fallback após falha",async()=>{vi.stubEnv("VITE_SSO_LEITURA_COMPROVANTE_UNIFICADA_ENABLED","true");mocks.invoke.mockResolvedValue({data:null,error:new Error("indisponível")});await expect(baixarComprovanteDespesa(despesa)).rejects.toThrow();expect(mocks.invoke).toHaveBeenCalledTimes(1);expect(mocks.invoke).toHaveBeenCalledWith("despesa-visita-comprovante-unificado",{body:{},headers:{"x-despesa-id":despesa}});});
