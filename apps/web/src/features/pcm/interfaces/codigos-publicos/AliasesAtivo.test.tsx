// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AliasesAtivo } from "./AliasesAtivo";
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:m.rpc}),auth:{getUser:async()=>({data:{user:{id:"u"}},error:null})}}}));
const id="17910000-0000-4000-8000-000000000001";
function montar(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AliasesAtivo userId="u" clienteId="c" tipo="sistema" ativoId={id}/></QueryClientProvider>);}
afterEach(()=>{vi.unstubAllEnvs();m.rpc.mockReset();});
describe("aliases do ativo",()=>{
  it("não consulta com flag desligada",()=>{vi.stubEnv("VITE_SSO_LISTAGEM_ALIASES_ENABLED","false");montar();expect(m.rpc).not.toHaveBeenCalled();});
  it("mostra códigos da resposta autorizada",async()=>{vi.stubEnv("VITE_SSO_LISTAGEM_ALIASES_ENABLED","true");m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:[{id,codigo:"ANTIGO",criado_em:"2026-01-01T00:00:00+00:00"}],error:null})});montar();expect(await screen.findByText(/ANTIGO/)).toBeTruthy();expect(m.rpc).toHaveBeenCalledWith("sso_listar_aliases_ativo",{p_cliente_id:"c",p_tipo:"sistema",p_ativo_id:id,p_apos:null,p_limite:20});});
  it("não afirma ausência quando servidor recusa acesso",async()=>{vi.stubEnv("VITE_SSO_LISTAGEM_ALIASES_ENABLED","true");m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:null,error:new Error("negado")})});montar();expect(await screen.findByRole("alert")).toHaveTextContent("indisponíveis");expect(screen.queryByText(/Nenhum alias/)).toBeNull();});
  it("permite reiniciar consulta para conferir alterações concorrentes",async()=>{vi.stubEnv("VITE_SSO_LISTAGEM_ALIASES_ENABLED","true");m.rpc.mockReturnValue({abortSignal:()=>Promise.resolve({data:[],error:null})});montar();await screen.findByText(/Nenhum alias/);fireEvent.click(screen.getByRole("button",{name:"Atualizar códigos anteriores"}));await waitFor(()=>expect(m.rpc).toHaveBeenCalledTimes(2));expect(m.rpc).toHaveBeenLastCalledWith("sso_listar_aliases_ativo",expect.objectContaining({p_apos:null}));});
});
