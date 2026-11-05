// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
import { OrigemGeracaoRotina } from "./OrigemGeracaoRotina";
const id=(n:number)=>`16610000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();vi.unstubAllEnvs();});
it.each(["primeira","replay"] as const)("trata revisão obsoleta na %s tentativa",async cenario=>{
 vi.stubEnv("VITE_SSO_ORIGEM_ROTINA_ENABLED","true");let chamadas=0;
 api.rpc.mockImplementation((nome:string)=>nome==="sso_consultar_origem_rotina"?{abortSignal:async()=>({data:{planoId:id(3),versaoId:id(4),rotinaId:id(5),revisao:1,rotinaLogicaId:id(7),alvoTipo:"sistema",alvoId:id(8),origem:null,exclusividadePmocComprovada:false},error:null})}:Promise.resolve({data:null,error:cenario==="replay"&&chamadas++===0?new Error("rede"):{code:"P0017",message:"revisao_obsoleta"}}));
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><OrigemGeracaoRotina userId="usuario" clienteId={id(2)} planoId={id(3)} versaoId={id(4)} rotinaId={id(5)} revision={1}/></QueryClientProvider>);
 await screen.findByText(/Origem atual: não declarada/);fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"PCM"}});fireEvent.click(screen.getByRole("checkbox",{name:/Confirmei a origem/}));fireEvent.click(screen.getByRole("button",{name:"Declarar origem"}));
 if(cenario==="primeira"){await screen.findByText(/A revisão mudou/);expect(sessionStorage.length).toBe(0);}else{fireEvent.click(await screen.findByRole("button",{name:"Repetir tentativa pendente"}));await screen.findByText(/Resultado não confirmado/);expect(sessionStorage.length).toBe(1);}
});
