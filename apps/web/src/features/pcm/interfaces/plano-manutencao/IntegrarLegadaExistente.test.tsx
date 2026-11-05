// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn(),queries:[] as Array<[string,unknown]>}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{schema:()=>({rpc:api.rpc,from:()=>{const q={select:()=>q,eq:(k:string,v:unknown)=>{api.queries.push([k,v]);return q;},order:()=>q,limit:()=>q,gt:()=>q,abortSignal:async()=>({data:[{id:"17600000-0000-4000-8000-000000000007",plano_id:"17600000-0000-4000-8000-000000000004",indice:2,vencimento:"2026-11-06",envio_estado:"prevista",resultado_estado:"pendente",auvo_task_id:null}],error:null})};return q;}})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
vi.mock("./FilaAposPreparacao",()=>({FilaAposPreparacao:()=> <p>Fila para conferência</p>}));
import { IntegrarLegadaExistente } from "./IntegrarLegadaExistente";
const id=(n:number)=>`17600000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();api.queries.length=0;});
for(const incerto of [false,true])it(incerto?"preserva tentativa idêntica em falha incerta":"vincula legada escolhida sem criar OS",async()=>{
 api.rpc.mockImplementation((_nome:string,args:Record<string,unknown>)=>incerto?Promise.resolve({data:null,error:new Error("rede")}):Promise.resolve({data:{requestId:args.p_request,preparadaId:args.p_preparada,legadaId:args.p_legada,cicloId:args.p_ciclo,vinculoCriado:true,ocorrenciaLegadaCriada:false,osCriada:false,tarefaAuvoCriada:false,equivalenciaGeralComprovada:false},error:null}));
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><IntegrarLegadaExistente userId={id(1)} clienteId={id(2)} planoId={id(3)} legadoId={id(4)} relacaoId={id(5)} preparadaId={id(6)} vencimento="2026-11-06" alvo="sistema A"/></QueryClientProvider>);
 await screen.findByRole("option",{name:/Índice 2/});fireEvent.change(screen.getByLabelText("Ocorrência legada"),{target:{value:id(7)}});fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Conferido"}});fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Vincular ocorrência existente"}));
 expect(api.queries).toContainEqual(["plano_id",id(4)]);expect(api.queries).toContainEqual(["vencimento","2026-11-06"]);
 if(incerto){await screen.findByText(/Resultado não confirmado/);const repetir=screen.getByRole("button",{name:"Repetir mesmo vínculo"});await waitFor(()=>expect(repetir).toBeEnabled());fireEvent.click(repetir);await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(2));expect(api.rpc.mock.calls[0]![1].p_request).toBe(api.rpc.mock.calls[1]![1].p_request);}
 else {expect(await screen.findByText(/Vínculo registrado/)).toBeTruthy();expect(screen.getByText("Fila para conferência")).toBeTruthy();expect(sessionStorage.length).toBe(0);}
});

it("preserva o pedido quando o primeiro envio retorna 40001 genérico",async()=>{
 api.rpc.mockResolvedValue({data:null,error:{code:"40001",message:"serialization_failure"}});
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><IntegrarLegadaExistente userId={id(1)} clienteId={id(2)} planoId={id(3)} legadoId={id(4)} relacaoId={id(5)} preparadaId={id(6)} vencimento="2026-11-06" alvo="sistema A"/></QueryClientProvider>);
 await screen.findByRole("option",{name:/Índice 2/});fireEvent.change(screen.getByLabelText("Ocorrência legada"),{target:{value:id(7)}});fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Conferido"}});fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Vincular ocorrência existente"}));
 await screen.findByText(/Resultado não confirmado/);expect(sessionStorage.length).toBe(1);expect(screen.getByRole("button",{name:"Repetir mesmo vínculo"})).toBeInTheDocument();
});
