// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
import { ReconciliarLegadaInerte } from "./ReconciliarLegadaInerte";
const id=(n:number)=>`17600000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();});
for (const pendente of [true,false]) it(`aceita recibo ${pendente ? "histórico" : "integrado"} sem perder a tentativa`,async()=>{
 api.rpc.mockImplementation((nome:string,args:Record<string,unknown>)=>{
  if(nome==="sso_listar_legadas_inertes_sso")return {abortSignal:async()=>({data:[{legada_id:id(4),escolha_request_id:id(5),vencimento:"2026-11-06",modo:"calendario",conflitante:false}],error:null})};
  if(nome==="sso_prever_reconciliacao_legada_sso")return {abortSignal:async()=>({data:{foto:{id:id(4)},registroPreparativo:true,execucaoAutorizada:false},error:null})};
  if(nome==="sso_consultar_declaracao_legada_sso")return {abortSignal:async()=>({data:{registrada:false,integracaoOperacionalPendente:false},error:null})};
  return Promise.resolve({data:{requestId:args.p_request,legadaId:id(4),escolhaRequestId:id(5),declaracaoRegistrada:true,integracaoOperacionalPendente:pendente,legadaAlterada:false,osCriada:false,tarefaAuvoCriada:false},error:null});
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}); render(<QueryClientProvider client={client}><ReconciliarLegadaInerte userId={id(1)} clienteId={id(2)} planoId={id(3)}/></QueryClientProvider>);
 await screen.findByRole("option",{name:/2026-11-06/});fireEvent.change(screen.getByLabelText("Ocorrência"),{target:{value:id(4)}});await screen.findByLabelText("Fotografia da ocorrência");fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Conferido pelo PCM"}});await screen.findByRole("checkbox");fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Registrar declaração"}));
 expect(await screen.findByText(pendente ? /Declaração registrada anteriormente/ : /Declaração registrada e integrada/)).toBeTruthy();expect(sessionStorage.length).toBe(0);
});
