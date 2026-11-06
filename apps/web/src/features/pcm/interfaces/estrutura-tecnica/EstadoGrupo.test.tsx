// @vitest-environment jsdom
import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { EstadoGrupo,GruposInativos } from "./EstadoGrupo";
const m=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:m.rpc}),auth:{getUser:m.getUser}}}));
const user="17692000-0000-4000-8000-000000000001",cliente="17692000-0000-4000-8000-000000000002",grupo="17692000-0000-4000-8000-000000000003",local="17692000-0000-4000-8000-000000000004",request="17692000-0000-4000-8000-000000000005";
const wrap=(ui:React.ReactNode)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{ui}</QueryClientProvider>);
beforeEach(()=>{vi.stubEnv("VITE_SSO_ESTADO_GRUPO_ENABLED","true");vi.stubGlobal("crypto",{randomUUID:()=>request});m.rpc.mockReset();m.getUser.mockReset().mockResolvedValue({data:{user:{id:user}},error:null});});afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("inativação exige motivo e repete a mesma tentativa incerta",async()=>{
 m.rpc.mockResolvedValue({data:null,error:new Error("incerto")});wrap(<EstadoGrupo userId={user} clienteId={cliente} grupoId={grupo} nome="Luminárias" revisao={1} ativo disponivel/>);
 fireEvent.click(screen.getByRole("button",{name:"Inativar Grupo"}));expect(screen.getByText(/não altera automaticamente Planos/)).toBeTruthy();fireEvent.change(screen.getByLabelText("Motivo da alteração"),{target:{value:"Revisão de cadastro"}});fireEvent.click(screen.getByRole("button",{name:"Confirmar inativação"}));
 expect(await screen.findByText(/Resultado não confirmado/)).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Repetir alteração de estado"}));await waitFor(()=>expect(m.rpc).toHaveBeenCalledTimes(2));expect(m.rpc.mock.calls[0]?.[1]).toEqual(m.rpc.mock.calls[1]?.[1]);expect(m.rpc.mock.calls[0]?.[1]).toMatchObject({p_request_id:request,p_grupo_id:grupo,p_ativo:false});
});
it("lista inativos autorizados para reativação sem inventar vínculos",async()=>{
 m.rpc.mockImplementation((nome:string)=>nome==="sso_listar_grupos_inativos"?{abortSignal:()=>Promise.resolve({data:[{id:grupo,nome:"Luminárias",revisao:2,local_id:local}],error:null})}:Promise.resolve({data:null,error:new Error("sem acesso")}));
 wrap(<GruposInativos userId={user} clienteId={cliente} locais={[{id:local,nome:"Salão"}]}/>);expect(await screen.findByText(/Luminárias/)).toBeTruthy();expect(screen.getByRole("button",{name:"Reativar Grupo"})).toBeTruthy();
});
