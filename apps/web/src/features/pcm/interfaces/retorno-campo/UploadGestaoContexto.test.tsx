// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UploadEvidenciaResposta } from "./UploadEvidenciaResposta";
import { GestaoReclassificacaoResposta } from "./GestaoReclassificacaoResposta";
const api=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:api.getUser},schema:()=>({rpc:api.rpc})}}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const userId=id(1),clienteId=id(2),retornoId=id(3),respostaId=id(4),requestId=id(5);
const auth={data:{user:{id:userId}},error:null};
const upload={requestId,clienteId,retornoId,respostaId,revision:0,caminho:`${clienteId}/${retornoId}/${id(6)}`,justificativa:"Conferido"};
const gestao={tipo:"proposta",requestId,clienteId,retornoId,respostaId,propostaRevision:0,validacaoRevision:0,resultado:"ok",observacao:"",motivo:"Conferido"};
const reabertura={requestId,clienteId,retornoId,revision:0,motivo:"Conferido"};
const casos=[
 {nome:"upload",chave:`sso-upload-resposta:${JSON.stringify([userId,clienteId,retornoId])}`,pedido:upload,rpc:"sso_resolver_upload_resposta_mediada",botao:"Verificar objeto e repetir registro",elemento:(r:string)=> <UploadEvidenciaResposta userId={userId} clienteId={clienteId} retornoId={r}/>,resposta:{data:true,error:null}},
 {nome:"reabertura",chave:`sso-reabrir-reclassificacao:${JSON.stringify([userId,clienteId,retornoId,respostaId])}`,pedido:reabertura,rpc:"sso_reabrir_reclassificacao_mediada",botao:"Repetir reabertura",elemento:(r:string)=> <GestaoReclassificacaoResposta userId={userId} clienteId={clienteId} retornoId={r} respostaId={respostaId}/>,resposta:{data:{requestId,retornoId,revision:1,respostaEfetivada:false,historicoPreservado:true},error:null}},
 {nome:"gestão",chave:`sso-reclassificacao:${JSON.stringify([userId,clienteId,retornoId,respostaId])}`,pedido:gestao,rpc:"sso_propor_reclassificacao_mediada",botao:"Repetir tentativa",elemento:(r:string)=> <GestaoReclassificacaoResposta userId={userId} clienteId={clienteId} retornoId={r} respostaId={respostaId}/>,resposta:{data:{requestId,revision:1,efetivada:false,respostaId},error:null}},
];
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.getUser.mockResolvedValue(auth);vi.stubEnv("VITE_SSO_GESTAO_RECLASSIFICACAO_ENABLED","true");vi.stubEnv("VITE_SSO_REABERTURA_RECLASSIFICACAO_ENABLED","false");});
afterEach(()=>{cleanup();vi.unstubAllEnvs();sessionStorage.clear();});
function montar(c:(typeof casos)[number]) {
 if(c.nome==="reabertura")vi.stubEnv("VITE_SSO_REABERTURA_RECLASSIFICACAO_ENABLED","true");
 const salvo=JSON.stringify(c.pedido);sessionStorage.setItem(c.chave,salvo);
 let liberar:(v:unknown)=>void=()=>{throw new Error("operação ausente");};
 api.rpc.mockImplementation((nome:string)=>{
  if(nome===c.rpc)return new Promise(resolve=>{liberar=resolve;});
  let data:unknown=[];
  if(nome==="sso_contexto_reclassificacao_mediada")data={respostaId,propostaRevision:0,decisaoRevision:0,validacaoRevision:0,historicoReconciliado:false,ultimaValidacao:null,jaAprovado:false};
  if(nome==="sso_previa_reclassificacao_mediada")data={respostaId,original:{resultado:"ok",observacao:null},proposta:null,efetivada:false,integracaoTransversalConcluida:false};
  return {abortSignal:async()=>({data,error:null})};
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 const view=(r:string)=><QueryClientProvider client={client}>{c.elemento(r)}</QueryClientProvider>;
 return {...render(view(retornoId)),view,salvo,concluir:()=>liberar(c.resposta)};
}
it.each(casos)("$nome preserva pedido ao trocar retorno durante resposta",async(c)=>{
 const tela=montar(c);fireEvent.click(screen.getByRole("button",{name:c.botao}));
 await waitFor(()=>expect(api.rpc.mock.calls.filter(([nome])=>nome===c.rpc)).toHaveLength(1));
 tela.rerender(tela.view(id(9)));await act(async()=>{tela.concluir();});
 expect(sessionStorage.getItem(c.chave)).toBe(tela.salvo);
 if(c.nome==="upload")expect(api.rpc.mock.calls.filter(([nome])=>nome==="sso_registrar_upload_resposta_mediada")).toHaveLength(0);
 expect(screen.queryByText(/Registro salvo como não efetivado|Objeto privado associado/)).toBeNull();
});
it.each(casos)("$nome preserva storage alterado enquanto resposta aguarda",async(c)=>{
 const tela=montar(c);fireEvent.click(screen.getByRole("button",{name:c.botao}));
 await waitFor(()=>expect(api.rpc.mock.calls.filter(([nome])=>nome===c.rpc)).toHaveLength(1));
 sessionStorage.setItem(c.chave,"outra tentativa");await act(async()=>{tela.concluir();});
 expect(sessionStorage.getItem(c.chave)).toBe("outra tentativa");
 if(c.nome==="upload")expect(api.rpc.mock.calls.filter(([nome])=>nome==="sso_registrar_upload_resposta_mediada")).toHaveLength(0);
});

it("reabertura não envia nem remove pedido após troca de sessão",async()=>{
 const c=casos.find(x=>x.nome==="reabertura");if(!c)throw new Error("Cenário ausente");
 api.getUser.mockResolvedValue({data:{user:{id:id(99)}},error:null});
 const tela=montar(c);fireEvent.click(screen.getByRole("button",{name:c.botao}));
 await screen.findByText(/Resultado não confirmado/);
 expect(api.rpc.mock.calls.filter(([nome])=>nome===c.rpc)).toHaveLength(0);
 expect(sessionStorage.getItem(c.chave)).toBe(tela.salvo);
});
