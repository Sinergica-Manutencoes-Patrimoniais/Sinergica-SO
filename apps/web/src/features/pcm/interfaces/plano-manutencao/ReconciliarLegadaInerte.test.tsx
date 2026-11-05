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
  if(nome==="sso_consultar_declaracao_legada_sso")return {abortSignal:async()=>({data:{registrada:false,integracaoAtual:false,integracaoOperacionalPendente:false},error:null})};
  return Promise.resolve({data:{requestId:args.p_request,legadaId:id(4),escolhaRequestId:id(5),declaracaoRegistrada:true,integracaoOperacionalPendente:pendente,legadaAlterada:false,osCriada:false,tarefaAuvoCriada:false},error:null});
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}}); render(<QueryClientProvider client={client}><ReconciliarLegadaInerte userId={id(1)} clienteId={id(2)} planoId={id(3)}/></QueryClientProvider>);
 await screen.findByRole("option",{name:/2026-11-06/});fireEvent.change(screen.getByLabelText("Ocorrência"),{target:{value:id(4)}});await screen.findByLabelText("Fotografia da ocorrência");fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Conferido pelo PCM"}});await screen.findByRole("checkbox");fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Registrar declaração"}));
 expect(await screen.findByText(pendente ? /Declaração registrada anteriormente/ : /Declaração registrada e integrada/)).toBeTruthy();expect(sessionStorage.length).toBe(0);
});
it("permite nova conferência quando a fotografia registrada ficou desatualizada",async()=>{
 api.rpc.mockImplementation((nome:string,args:Record<string,unknown>)=>{
  if(nome==="sso_listar_legadas_inertes_sso")return {abortSignal:async()=>({data:[{legada_id:id(4),escolha_request_id:id(5),vencimento:"2026-11-06",modo:"visita",conflitante:false}],error:null})};
  if(nome==="sso_prever_reconciliacao_legada_sso")return {abortSignal:async()=>({data:{foto:{id:id(4),versao:2},registroPreparativo:true,execucaoAutorizada:false},error:null})};
  if(nome==="sso_consultar_declaracao_legada_sso")return {abortSignal:async()=>({data:{registrada:true,fotografiaAtual:false,integracaoAtual:false,integracaoOperacionalPendente:false},error:null})};
  return Promise.resolve({data:{requestId:args.p_request,legadaId:id(4),escolhaRequestId:id(5),declaracaoRegistrada:true,integracaoOperacionalPendente:false,legadaAlterada:false,osCriada:false,tarefaAuvoCriada:false},error:null});
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><ReconciliarLegadaInerte userId={id(1)} clienteId={id(2)} planoId={id(3)}/></QueryClientProvider>);
 await screen.findByRole("option",{name:/2026-11-06/});fireEvent.change(screen.getByLabelText("Ocorrência"),{target:{value:id(4)}});await screen.findByText(/Reconciliação inativa/);fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Nova conferência PCM"}});fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Registrar declaração"}));
 expect(await screen.findByText(/Declaração registrada e integrada/)).toBeTruthy();expect(api.rpc).toHaveBeenCalledWith("sso_reconciliar_legada_sso",expect.objectContaining({p_foto_esperada:{id:id(4),versao:2}}));
});
it("mantém reconciliação ativa quando Chamado SSO altera fotografia histórica",async()=>{
 api.rpc.mockImplementation((nome:string)=>{
  if(nome==="sso_listar_legadas_inertes_sso")return {abortSignal:async()=>({data:[{legada_id:id(4),escolha_request_id:id(5),vencimento:"2026-11-06",modo:"calendario",conflitante:false}],error:null})};
  if(nome==="sso_prever_reconciliacao_legada_sso")return {abortSignal:async()=>({data:{foto:{id:id(4),efeitoSso:true},registroPreparativo:true,execucaoAutorizada:false},error:null})};
  if(nome==="sso_consultar_declaracao_legada_sso")return {abortSignal:async()=>({data:{registrada:true,fotografiaAtual:false,integracaoAtual:true,integracaoOperacionalPendente:false},error:null})};
  throw new Error("não deve registrar nova declaração");
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><ReconciliarLegadaInerte userId={id(1)} clienteId={id(2)} planoId={id(3)}/></QueryClientProvider>);
 await screen.findByRole("option",{name:/2026-11-06/});fireEvent.change(screen.getByLabelText("Ocorrência"),{target:{value:id(4)}});
 await screen.findByText(/Reconciliação ativa/);expect((screen.getByRole("button",{name:"Registrar declaração"}) as HTMLButtonElement).disabled).toBe(true);
});
for(const incerta of [false,true]) it(incerta?"preserva replay se resposta 40001 vier após falha de rede":"libera nova conferência em 40001 na primeira tentativa",async()=>{
 let envios=0;
 api.rpc.mockImplementation((nome:string)=>{
  if(nome==="sso_listar_legadas_inertes_sso")return {abortSignal:async()=>({data:[{legada_id:id(4),escolha_request_id:id(5),vencimento:"2026-11-06",modo:"calendario",conflitante:false}],error:null})};
  if(nome==="sso_prever_reconciliacao_legada_sso")return {abortSignal:async()=>({data:{foto:{id:id(4)},registroPreparativo:true,execucaoAutorizada:false},error:null})};
  if(nome==="sso_consultar_declaracao_legada_sso")return {abortSignal:async()=>({data:{registrada:false,integracaoAtual:false,integracaoOperacionalPendente:false},error:null})};
  envios++;return Promise.resolve({data:null,error:incerta&&envios===1?new Error("rede"):{code:"40001"}});
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><ReconciliarLegadaInerte userId={id(1)} clienteId={id(2)} planoId={id(3)}/></QueryClientProvider>);
 await screen.findByRole("option",{name:/2026-11-06/});fireEvent.change(screen.getByLabelText("Ocorrência"),{target:{value:id(4)}});await screen.findByLabelText("Fotografia da ocorrência");fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Conferido pelo PCM"}});await screen.findByRole("checkbox");fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Registrar declaração"}));
 if(incerta){fireEvent.click(await screen.findByRole("button",{name:"Repetir mesma tentativa"}));await screen.findByText(/Resultado não confirmado/);expect(sessionStorage.length).toBe(1);expect(screen.getByRole("button",{name:"Repetir mesma tentativa"})).toBeTruthy();}
 else {await screen.findByText(/As fontes mudaram/);expect(sessionStorage.length).toBe(0);expect(screen.queryByRole("button",{name:"Repetir mesma tentativa"})).toBeNull();}
});
