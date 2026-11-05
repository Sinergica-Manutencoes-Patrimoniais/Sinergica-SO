// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
import { LoteOcorrenciasVisita } from "./LoteOcorrenciasVisita";
const id=(n:number)=>`16610000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();});
it.each(["visita_candidata_alterada","serialization failure"])("preserva lote e payload após 40001: %s",async mensagem=>{
 api.rpc.mockResolvedValue({data:null,error:{code:"40001",message:mensagem}});
 const candidatos=[{visita_id:id(1),semana_origem:"2026-11-02",vencimento_original:"2026-11-06",estado_visita:"planejada",feriado_declarado:false,vigencia_declarada:true,ocorrencia_preparada:false}];
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><LoteOcorrenciasVisita userId="usuario" clienteId={id(2)} planoId={id(3)} versaoId={id(4)} rotinaId={id(5)} serieId={id(6)} revision={1} candidatos={candidatos} consultando={false}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole("checkbox",{name:/Visita 1661/}));fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"),{target:{value:"PCM"}});fireEvent.click(screen.getByRole("checkbox",{name:/Conferi cada Visita/}));fireEvent.click(screen.getByRole("button",{name:"Preparar lote"}));
 const repetir=await screen.findByRole("button",{name:"Repetir mesmo lote"});await waitFor(()=>expect((repetir as HTMLButtonElement).disabled).toBe(false));fireEvent.click(repetir);await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(2));expect(api.rpc.mock.calls[1]?.[1]).toEqual(api.rpc.mock.calls[0]?.[1]);expect(sessionStorage.length).toBe(1);
});
it.each([["primeira","P0016","revisao_ou_plano_indisponivel"],["replay","P0016","revisao_ou_plano_indisponivel"],["primeira","P0020","visita_candidata_alterada"],["replay","P0020","visita_candidata_alterada"]] as const)("trata conflito de lote na %s tentativa",async (cenario,codigo,mensagem)=>{
 let chamadas=0;api.rpc.mockImplementation(()=>Promise.resolve({data:null,error:cenario==="replay"&&chamadas++===0?new Error("rede"):{code:codigo,message:mensagem}}));
 const candidatos=[{visita_id:id(1),semana_origem:"2026-11-02",vencimento_original:"2026-11-06",estado_visita:"planejada",feriado_declarado:false,vigencia_declarada:true,ocorrencia_preparada:false}];
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false}}})}><LoteOcorrenciasVisita userId="usuario" clienteId={id(2)} planoId={id(3)} versaoId={id(4)} rotinaId={id(5)} serieId={id(6)} revision={1} candidatos={candidatos} consultando={false}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole("checkbox",{name:/Visita 1661/}));fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"),{target:{value:"PCM"}});fireEvent.click(screen.getByRole("checkbox",{name:/Conferi cada Visita/}));fireEvent.click(screen.getByRole("button",{name:"Preparar lote"}));
 if(cenario==="primeira"){await screen.findByText(/A revisão ou a Visita selecionada mudou/);expect(sessionStorage.length).toBe(0);}else{fireEvent.click(await screen.findByRole("button",{name:"Repetir mesmo lote"}));await screen.findByText(/Resultado não confirmado/);expect(sessionStorage.length).toBe(1);}
});

it("invalida reservas do mesmo usuário, Cliente e Plano após preparar lote",async()=>{
 const usuario=id(7),cliente=id(2),plano=id(3);
 const visitas=["reserva-futuro-visitas",usuario,cliente,plano,id(4),id(5),false,id(6),"2026-11-01","2026-11-30"];
 const reserva=["reserva-futuro",usuario,cliente,plano,id(4),id(5),id(8),1,"visita"];
 const outro=["reserva-futuro",usuario,id(9),plano,id(4),id(5),id(8),1,"visita"];
 const client=new QueryClient({defaultOptions:{mutations:{retry:false}}});for(const chave of [visitas,reserva,outro])client.setQueryData(chave,{valor:"anterior"});
 api.rpc.mockImplementation((_nome:string,p:{p_request_id:string;p_itens:{visitaId:string;ocorrenciaId:string}[]})=>Promise.resolve({error:null,data:{requestId:p.p_request_id,itens:p.p_itens.map((i)=>({requestId:id(10),ocorrenciaId:i.ocorrenciaId,cicloVisitaId:id(11),visitaId:i.visitaId,criada:true,osCriada:false,tarefaAuvoCriada:false,fonteFeriadosCompleta:false})),atomico:true,osCriada:false,tarefaAuvoCriada:false,fonteFeriadosCompleta:false}}));
 const candidatos=[{visita_id:id(1),semana_origem:"2026-11-02",vencimento_original:"2026-11-06",estado_visita:"planejada",feriado_declarado:false,vigencia_declarada:true,ocorrencia_preparada:false}];
 render(<QueryClientProvider client={client}><LoteOcorrenciasVisita userId={usuario} clienteId={cliente} planoId={plano} versaoId={id(4)} rotinaId={id(5)} serieId={id(6)} revision={1} candidatos={candidatos} consultando={false}/></QueryClientProvider>);
 fireEvent.click(screen.getByRole("checkbox",{name:/Visita 1661/}));fireEvent.change(screen.getByLabelText("Fonte consultada para cada dia"),{target:{value:"PCM"}});fireEvent.click(screen.getByRole("checkbox",{name:/Conferi cada Visita/}));fireEvent.click(screen.getByRole("button",{name:"Preparar lote"}));
 await waitFor(()=>expect(client.getQueryState(visitas)?.isInvalidated).toBe(true));
 expect(client.getQueryState(reserva)?.isInvalidated).toBe(true);expect(client.getQueryState(outro)?.isInvalidated).toBe(false);
});
