// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
vi.mock("../../infrastructure/supabase-capacidades-sso-adapter",()=>({supabaseCapacidadesSsoAdapter:{autorizarAcao:async()=>true}}));
import { PropostaPmoc } from "./PropostaPmoc";
import { DecisaoPmoc } from "./DecisaoPmoc";
const id=(n:number)=>`16630000-1111-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();});
it.each([["proposta","primeira","P0011","revisao_obsoleta"],["proposta","replay","P0011","revisao_obsoleta"],["decisao","primeira","P0017","plano_alterado"],["decisao","replay","P0017","plano_alterado"]] as const)("%s: %s %s",async(tela,cenario,code,message)=>{
 let n=0;api.rpc.mockImplementation((nome:string)=>{if(nome==="sso_candidatos_pmoc_mediados")return {abortSignal:async()=>({data:[{id:id(7),scheduled_date:"2026-11-05",maintenance_type:"mensal",status:"planejado"}],error:null})};if(nome==="sso_propostas_pmoc_mediadas"||nome==="sso_decisoes_pmoc_mediadas")return {abortSignal:async()=>({data:[],error:null})};return Promise.resolve({data:null,error:cenario==="replay"&&n++===0?new Error("rede"):{code,message}});});
 const props={userId:"usuario",clienteId:id(2)};render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{tela==="proposta"?<PropostaPmoc {...props} planoId={id(3)} versaoId={id(4)} rotinaId={id(5)} revision={1} vencimento="2026-11-05"/>:<DecisaoPmoc {...props} propostaId={id(6)}/>}</QueryClientProvider>);
 if(tela==="proposta"){await screen.findByRole("option",{name:/mensal/});fireEvent.change(screen.getByLabelText("Agendamento PMOC da mesma data"),{target:{value:id(7)}});}else{await screen.findByLabelText("Referência da evidência formal");fireEvent.change(screen.getByLabelText("Referência da evidência formal"),{target:{value:"Documento PCM"}});}
 fireEvent.change(screen.getByLabelText("Justificativa"),{target:{value:"Conferido"}});fireEvent.click(screen.getByRole("button",{name:tela==="proposta"?"Registrar proposta pendente":"Registrar decisão"}));
 if(cenario==="primeira"){await screen.findByText(/Os dados mudaram/);expect(sessionStorage.length).toBe(0);}else{fireEvent.click(await screen.findByRole("button",{name:"Repetir tentativa pendente"}));await waitFor(()=>expect(n).toBeGreaterThanOrEqual(2));expect(sessionStorage.length).toBe(1);}
});
