// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:mocks.getUser},schema:()=>({rpc:mocks.rpc})}}));
import { CiclosUniformes } from "./CiclosUniformes";

const usuario="16600000-0000-4000-8000-000000000001";
const entrada={userId:usuario,clienteId:"cliente",planoId:"plano",versaoId:"versao",rotinaId:"rotina"};
const usuarioAtual={data:{user:{id:usuario}},error:null};
const linha=(chave:string)=>({origem:"calendario",chave,vencimento:"2026-12-25",tolerancia_antes:0,tolerancia_depois:0,semana_origem:null,estado_visita:null,feriado:"indeterminado",vigencia_declarada:null,ocorrencia_preparada:null,fonte_incompleta:true});
function montar(){vi.stubEnv("VITE_SSO_CICLOS_UNIFORMES_MEDIADOS_ENABLED","true");const c=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={c}><CiclosUniformes {...entrada}/></QueryClientProvider>);fireEvent.change(screen.getByLabelText("De"),{target:{value:"2026-01-01"}});fireEvent.change(screen.getByLabelText("Até"),{target:{value:"2026-12-31"}});fireEvent.click(screen.getByRole("button",{name:"Consultar"}));}
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.resetAllMocks();});

it("apresenta os ciclos em ordem numérica sem alterar seu vencimento",async()=>{
  mocks.getUser.mockResolvedValue(usuarioAtual);mocks.rpc.mockReturnValue({abortSignal:async()=>({data:[linha("2"),linha("10")],error:null})});
  montar();expect(await screen.findByText(/chave 10 · vencimento 2026-12-25/)).toBeInTheDocument();
});
it("oculta o resultado quando a sessão muda durante a consulta",async()=>{
  mocks.getUser.mockResolvedValueOnce(usuarioAtual).mockResolvedValueOnce({data:{user:{id:"outro"}},error:null});
  mocks.rpc.mockReturnValue({abortSignal:async()=>({data:[linha("2")],error:null})});
  montar();expect(await screen.findByRole("alert")).toBeInTheDocument();expect(screen.queryByText(/chave 2 · vencimento/)).toBeNull();
});
it("recusa ciclos duplicados em uma página",async()=>{
  mocks.getUser.mockResolvedValue(usuarioAtual);mocks.rpc.mockReturnValue({abortSignal:async()=>({data:[linha("2"),linha("2")],error:null})});
  montar();expect(await screen.findByRole("alert")).toBeInTheDocument();expect(screen.queryByText(/chave 2 · vencimento/)).toBeNull();
});
it("envia usuário e Cliente ao mediador quando a flag está habilitada",async()=>{
  vi.stubEnv("VITE_SSO_CICLOS_UNIFORMES_MEDIADOS_ENABLED","true");
  mocks.getUser.mockResolvedValue(usuarioAtual);mocks.rpc.mockReturnValue({abortSignal:async()=>({data:[linha("2")],error:null})});
  montar();await screen.findByText(/chave 2 · vencimento/);
  expect(mocks.rpc).toHaveBeenCalledWith("sso_consultar_ciclos_uniformes_mediada",expect.objectContaining({p_ator_esperado:usuario,p_cliente_id:"cliente",p_plano_id:"plano"}));
});
