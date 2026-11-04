// @vitest-environment jsdom
import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { ConferenciaFotosCanceladas } from "./ConferenciaFotosCanceladas";
const m=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:m.rpc}),auth:{getUser:m.getUser}}}));
const user="17991000-0000-4000-8000-000000000001",cliente="17991000-0000-4000-8000-000000000002",lote="17991000-0000-4000-8000-000000000003",request="17991000-0000-4000-8000-000000000004",observacao="17991000-0000-4000-8000-000000000005";
const lista=[{request_id:request,cancelada_em:"2026-10-30T10:00:00Z",ultima_observacao_em:null,objeto_catalogado:null}];
beforeEach(()=>{vi.stubEnv("VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED","true");vi.stubGlobal("crypto",{randomUUID:()=>observacao});m.rpc.mockReset();m.getUser.mockReset().mockResolvedValue({data:{user:{id:user}},error:null});});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllEnvs();vi.unstubAllGlobals();});
function montar(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ConferenciaFotosCanceladas userId={user} clienteId={cliente} loteId={lote} chave="a"/></QueryClientProvider>);}
it("confere catálogo com retry idempotente sem remover objeto",async()=>{
 let chamadas=0;m.rpc.mockImplementation((nome:string)=>nome==="sso_listar_fotos_canceladas"?{abortSignal:()=>Promise.resolve({data:lista,error:null})}:Promise.resolve(++chamadas===1?{data:null,error:new Error("incerto")}:{data:{observacaoId:observacao,requestId:request,objetoCatalogado:true,observadoEm:"2026-10-30T11:00:00Z"},error:null}));
 montar();expect(await screen.findByText(request)).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Conferir catálogo"}));expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Repetir conferência"}));await waitFor(()=>expect(m.rpc.mock.calls.filter(c=>c[0]==="sso_conferir_foto_cancelada")).toHaveLength(2));
 const chamadasRpc=m.rpc.mock.calls.filter(c=>c[0]==="sso_conferir_foto_cancelada");expect(chamadasRpc[0]?.[1]).toEqual(chamadasRpc[1]?.[1]);expect(await screen.findByText(/não prova presença física/i)).toBeTruthy();
 expect(m.rpc.mock.calls.every(c=>["sso_listar_fotos_canceladas","sso_conferir_foto_cancelada"].includes(c[0]))).toBe(true);
});
it("não exibe painel com gate desligado",()=>{vi.stubEnv("VITE_SSO_FOTO_INGESTAO_SEGURA_ENABLED","false");montar();expect(screen.queryByText("Tentativas canceladas")).toBeNull();});
it("troca de sessão impede interpretar conferência como concluída",async()=>{
 m.rpc.mockImplementation((nome:string)=>nome==="sso_listar_fotos_canceladas"?{abortSignal:()=>Promise.resolve({data:lista,error:null})}:Promise.resolve({data:{observacaoId:observacao,requestId:request,objetoCatalogado:true,observadoEm:"2026-10-30T11:00:00Z"},error:null}));
 m.getUser.mockResolvedValueOnce({data:{user:{id:user}},error:null}).mockResolvedValueOnce({data:{user:{id:"outro"}},error:null});
 montar();await screen.findByText(request);fireEvent.click(screen.getByRole("button",{name:"Conferir catálogo"}));expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();expect(sessionStorage.length).toBe(1);
});
