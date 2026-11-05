// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
import { LoteOcorrenciasVisita } from "./LoteOcorrenciasVisita";
const id=(n:number)=>`16610000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();});
it.each(["primeira","replay"] as const)("trata conflito de lote na %s tentativa",async cenario=>{
 let chamadas=0;api.rpc.mockImplementation(()=>Promise.resolve({data:null,error:cenario==="replay"&&chamadas++===0?new Error("rede"):{code:"P0016",message:"revisao_ou_plano_indisponivel"}}));
 const candidatos=[{visita_id:id(1),semana_origem:"2026-11-02",vencimento_original:"2026-11-06",estado_visita:"planejada",feriado_declarado:false,vigencia_declarada:true,ocorrencia_preparada:false}];
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><LoteOcorrenciasVisita userId="usuario" clienteId={id(2)} planoId={id(3)} versaoId={id(4)} rotinaId={id(5)} serieId={id(6)} revision={1} candidatos={candidatos} consultando={false}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole("checkbox",{name:/Visita 1661/}));fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"),{target:{value:"PCM"}});fireEvent.click(screen.getByRole("checkbox",{name:/Conferi cada Visita/}));fireEvent.click(screen.getByRole("button",{name:"Preparar lote"}));
 if(cenario==="primeira"){await screen.findByText(/A revisão mudou/);expect(sessionStorage.length).toBe(0);}else{fireEvent.click(await screen.findByRole("button",{name:"Repetir mesmo lote"}));await screen.findByText(/Resultado não confirmado/);expect(sessionStorage.length).toBe(1);}
});
