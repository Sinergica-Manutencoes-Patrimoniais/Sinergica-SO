// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:id(1)}},error:null})},schema:()=>({rpc:api.rpc})}}));
import { AlterarDiaComVisitas } from "./AlterarDiaComVisitas";
const id=(n:number)=>`17600000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();vi.unstubAllEnvs();});
it.each([{candidatas:500,permitida:true},{candidatas:501,permitida:false}])("501 Visitas e $candidatas candidatas: confirmação permitida=$permitida",async({candidatas,permitida})=>{
 vi.stubEnv("VITE_SSO_PREVIA_IMPEDIMENTOS_DIA_ENABLED","false");vi.stubEnv("VITE_SSO_EXCECAO_VISITA_ENABLED","false");
 const linhas=Array.from({length:501},(_,i)=>({visita_id:id(i+100),semana_origem:"2026-11-02",regra_origem_id:id(5),inicio_em:"2026-11-06T12:00:00Z",estado:"planejada",revisao:1,data_proposta:"2026-11-03",classificacao:i<candidatas?"candidata_revisao":"preservar_e_conferir"}));
 api.rpc.mockImplementation((nome:string,p:Record<string,unknown>)=>{
  if(nome==="sso_prever_mudanca_dia")return {abortSignal:async()=>({data:linhas.filter(v=>!p.p_apos_id||v.visita_id>String(p.p_apos_id)).slice(0,100),error:null})};
  if(nome==="sso_alterar_dia_com_visitas")return Promise.resolve({data:{requestId:p.p_request_id,serieId:p.p_serie_id,regraId:p.p_regra_nova_id,revision:2,visitasMovidas:(p.p_revisoes as unknown[]).length,visitasSuprimidas:0,efeitoRemoto:false},error:null});
  throw new Error(`RPC inesperada: ${nome}`);
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});render(<QueryClientProvider client={client}><AlterarDiaComVisitas userId={id(1)} clienteId={id(2)} serieId={id(3)} revisao={1} dia={2} vigencia="2026-11-02" bloqueado={false}/></QueryClientProvider>);
 await screen.findByText(/100 Visita\(s\) carregada/);
 for(const total of [200,300,400,500,501]){const mais=await screen.findByRole("button",{name:"Carregar mais Visitas"});await waitFor(()=>expect(mais).toBeEnabled());fireEvent.click(mais);await screen.findByText(new RegExp(`${total} Visita\\(s\\) carregada`));}
 const confirmar=screen.getByRole("checkbox",{name:/Conferi todas as Visitas/});const botao=screen.getByRole("button",{name:"Alterar regra e Visitas"});
 if(!permitida){expect(confirmar).toBeDisabled();expect(botao).toBeDisabled();expect(screen.getByRole("alert")).toHaveTextContent(/Mais de 500 Visitas candidatas/);expect(api.rpc.mock.calls.filter(([nome])=>nome==="sso_alterar_dia_com_visitas")).toHaveLength(0);return;}
 expect(confirmar).toBeEnabled();fireEvent.click(confirmar);expect(botao).toBeEnabled();fireEvent.click(botao);
 await waitFor(()=>expect(api.rpc.mock.calls.filter(([nome])=>nome==="sso_alterar_dia_com_visitas")).toHaveLength(1));
 const chamada=api.rpc.mock.calls.find(([nome])=>nome==="sso_alterar_dia_com_visitas");if(!chamada)throw new Error("Chamada ausente");const revisoes=chamada[1].p_revisoes as {visitaId:string;revisao:number}[];
 expect(revisoes).toHaveLength(500);expect(revisoes).toEqual(linhas.slice(0,500).map(v=>({visitaId:v.visita_id,revisao:1})));expect(revisoes.some(v=>v.visitaId===linhas[500]?.visita_id)).toBe(false);
});
