// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:api.getUser},schema:()=>({rpc:api.rpc})}}));
import { EvidenciasDeclaradas } from "./EvidenciasDeclaradas";
const id=(n:number)=>`18150000-0000-4000-8000-${String(n).padStart(12,"0")}`;
afterEach(()=>{cleanup();sessionStorage.clear();vi.resetAllMocks();vi.unstubAllEnvs();});
it.each([{ decisao:"aceita_pcm", motivo:"Foto conferida" }, { decisao:"rejeitada_pcm", motivo:"Foto ilegível" }] as const)("abre retorno, registra $decisao e devolve/reabre com motivo",async({decisao,motivo})=>{
 vi.stubEnv("VITE_SSO_DECISOES_RETORNO_ENABLED","true");vi.stubEnv("VITE_SSO_UPLOAD_EVIDENCIA_RESPOSTA_ENABLED","true");vi.stubEnv("VITE_SSO_VALIDACAO_RESPOSTA_ENABLED","true");
 api.getUser.mockResolvedValue({data:{user:{id:id(1)}},error:null});
 const historico: {revisao:number;decisao:string;motivo:string;ator_id:string;criado_em:string}[]=[];
 const upload={id:id(6),resposta_id:id(5),revisao:1,mime_declarado:"image/jpeg",justificativa:"Evidência recebida",criado_em:"2026-11-01T12:00:00Z"};
 api.rpc.mockImplementation((nome:string,p:Record<string,unknown>)=>{
  if(nome==="sso_validar_resposta_evidencia_mediada")return Promise.resolve({data:{requestId:p.p_request_id,validacaoId:id(9),revision:1,conteudoAutenticado:false},error:null});
  if(nome==="sso_decidir_retorno_mediado"){const revision=historico.length+1;historico.unshift({revisao:revision,decisao:String(p.p_decisao),motivo:String(p.p_motivo),ator_id:id(1),criado_em:"2026-11-01T12:00:00Z"});return Promise.resolve({data:{requestId:p.p_request_id,retornoId:id(3),decisaoId:id(10),revision},error:null});}
  let data:unknown=[];
  if(nome==="sso_listar_retornos_declarados_mediada")data=[{retorno_id:id(3),os_id:id(4),envelope_id:id(7),revisao_evidencias:1}];
  if(nome==="sso_listar_uploads_resposta_mediada")data=[upload];
  if(nome==="sso_listar_respostas_retorno_mediada")data=[{id:id(5),chave_pergunta:"Verificação",resultado:"não conforme"}];
  if(nome==="sso_listar_decisoes_retorno_mediado")data=[...historico];
  return {abortSignal:async()=>({data,error:null})};
 });
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});render(<QueryClientProvider client={client}><EvidenciasDeclaradas userId={id(1)} clienteId={id(2)}/></QueryClientProvider>);
 fireEvent.click(await screen.findByRole("button",{name:"Conferir evidências"}));
 const validacao=await screen.findByRole("region",{name:"Decisão de resposta e evidência"});
 await waitFor(()=>expect(within(validacao).getByRole("button",{name:"Registrar decisão"})).toBeEnabled());
 fireEvent.change(within(validacao).getByLabelText("Decisão"),{target:{value:decisao}});fireEvent.change(within(validacao).getByLabelText("Motivo"),{target:{value:motivo}});fireEvent.click(within(validacao).getByRole("button",{name:"Registrar decisão"}));
 await within(validacao).findByText(/Decisão humana registrada/);
 expect(api.rpc).toHaveBeenCalledWith("sso_validar_resposta_evidencia_mediada",expect.objectContaining({p_cliente_id:id(2),p_retorno_id:id(3),p_resposta_id:id(5),p_evidencia_id:id(6),p_expected_uploads:1,p_decisao:decisao,p_justificativa:motivo}));
 const decisoes=screen.getByRole("region",{name:"Decisões do retorno"});
 for(const [acao,motivo,revisao] of [["devolver","Falta complemento",0],["reabrir","Complemento recebido",1]] as const){
  const botao=within(decisoes).getByRole("button",{name:"Registrar decisão"});await waitFor(()=>expect(botao).toBeEnabled());
  fireEvent.change(within(decisoes).getByLabelText("Decisão"),{target:{value:acao}});fireEvent.change(within(decisoes).getByLabelText("Motivo"),{target:{value:motivo}});fireEvent.click(botao);
  await waitFor(()=>expect(api.rpc).toHaveBeenCalledWith("sso_decidir_retorno_mediado",expect.objectContaining({p_cliente_id:id(2),p_retorno_id:id(3),p_expected_revision:revisao,p_decisao:acao,p_motivo:motivo})));
  await waitFor(()=>expect(within(decisoes).getByText(new RegExp(`Revisão ${revisao+1} · ${acao}`))).toBeInTheDocument());
 }
 expect(api.rpc.mock.calls.filter(([nome])=>nome==="sso_decidir_retorno_mediado")).toHaveLength(2);
 expect(api.rpc.mock.calls.filter(([nome])=>nome.includes("finalizar")||nome.includes("aprovar"))).toHaveLength(0);
});
