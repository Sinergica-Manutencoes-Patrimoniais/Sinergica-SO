// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TriagemCicloAtrasado } from "./TriagemCicloAtrasado";
import { DecisaoFeriadoCalendario } from "./DecisaoFeriadoCalendario";
import { MaterializarCicloCanonico } from "./MaterializarCicloCanonico";
import { MaterializarLoteCalendario } from "./MaterializarLoteCalendario";
const api=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:api.getUser},schema:()=>({rpc:api.rpc})}}));
vi.mock("./diagnostico-revisao-sessao",()=>({conferirSessaoDiagnostico:async()=>{}}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const usuario=id(1),clienteId=id(2),planoId=id(3),versaoId=id(4),rotinaId=id(5),requestId=id(6),preparadaId=id(7),feriadoId=id(8),data="2026-11-05";
const base={userId:usuario,clienteId,planoId,versaoId,rotinaId,revision:1};
const auth={data:{user:{id:usuario}},error:null};
const casos=[
 {nome:"triagem",chave:`sso-triagem-atraso:${JSON.stringify([usuario,clienteId,planoId,rotinaId])}`,pedido:{requestId,clienteId,preparadaId,revisao:0,data,decisao:"avaliar",motivo:"Conferido"},rpc:"sso_triar_ciclo_atrasado",elemento:()=> <TriagemCicloAtrasado userId={usuario} clienteId={clienteId} planoId={planoId} rotinaId={rotinaId}/>,recibo:{requestId,preparadaId,revisao:1,dataReferencia:data,decisao:"avaliar",dataBaseAlterada:false,ocorrenciaCriada:false,osCriada:false,tarefaAuvoCriada:false}},
 {nome:"feriado",chave:`sso-feriado-ciclo:${JSON.stringify([usuario,clienteId,planoId,versaoId,rotinaId,0])}`,pedido:{requestId,clienteId,preparadaId,feriadoId,revisao:0,motivo:"Conferido"},rpc:"sso_decidir_feriado_calendario",elemento:()=> <DecisaoFeriadoCalendario userId={usuario} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} ciclo={0}/>,recibo:{requestId,preparadaId,revisao:1,decisao:"manter_para_pcm",estadoOperacionalAlterado:false,dataBaseAlterada:false,osCriada:false,tarefaAuvoCriada:false}},
 {nome:"ciclo",chave:`sso-ciclo-canonico:${JSON.stringify([usuario,clienteId,planoId,versaoId,rotinaId,0,data])}`,pedido:{requestId,clienteId,planoId,versaoId,rotinaId,revision:1,ciclo:0,vencimento:data},rpc:"sso_materializar_ciclo_canonico",elemento:()=> <MaterializarCicloCanonico {...base} ciclo={0} vencimento={data}/>,recibo:{requestId,indice:0,vencimentoOriginal:data,preparadaId,cicloCanonicoId:id(9),criada:true,osCriada:false,tarefaAuvoCriada:false}},
 {nome:"lote",chave:`sso-lote-ciclos-calendario:${JSON.stringify([usuario,clienteId,planoId,versaoId,rotinaId])}`,pedido:{requestId,clienteId,planoId,versaoId,rotinaId,revision:1,inicio:data,fim:data},rpc:"sso_materializar_lote_calendario",elemento:()=> <MaterializarLoteCalendario {...base} inicio={data} fim={data} ciclos={[{ciclo:0,vencimento:data}]}/>,recibo:{requestId,inicio:data,fim:data,atomico:true,total:1,criadas:1,itens:[{indice:0,vencimentoOriginal:data,preparadaId,cicloCanonicoId:id(9),criada:true}],osCriada:false,tarefaAuvoCriada:false}},
];
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.getUser.mockResolvedValue(auth);vi.stubEnv("VITE_SSO_ORIGEM_EFETIVA_CICLO_ENABLED","false");vi.stubEnv("VITE_SSO_ORIGEM_LOTE_ENABLED","false");});
afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllEnvs();});
async function montar(c:(typeof casos)[number]) {
 sessionStorage.setItem(c.chave,JSON.stringify(c.pedido));
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 const original=api.rpc.getMockImplementation();
 if(c.nome==="feriado") api.rpc.mockImplementation((nome:string,...args:unknown[])=>nome==="sso_listar_feriados_ciclo"
   ? {abortSignal:async()=>({data:{preparadaExiste:false,feriados:[],fonteCompleta:false},error:null})}
   : original?.(nome,...args));
 const tela=render(<QueryClientProvider client={client}>{c.elemento()}</QueryClientProvider>);
 if(c.nome==="feriado") {
   fireEvent.click(screen.getByRole("button",{name:"Conferir decisão de feriado"}));
   await screen.findByText(/Ocorrência desta versão não encontrada/);
   api.rpc.mockReset();
   if(original) api.rpc.mockImplementation(original);
 }
 return tela;
}
it.each(casos)("$nome preserva tentativa ao desmontar durante autenticação",async(c)=>{
 let iniciou=false;let liberar:(v:unknown)=>void=()=>{throw new Error("auth ausente");};
 const tela=await montar(c);
 api.getUser.mockImplementationOnce(()=>new Promise((resolve)=>{iniciou=true;liberar=resolve;}));
 fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa pendente"}));
 await waitFor(()=>expect(iniciou).toBe(true));tela.unmount();await act(async()=>{liberar(auth);});
 expect(api.rpc).not.toHaveBeenCalled();expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
it.each(casos)("$nome preserva tentativa ao desmontar durante resposta",async(c)=>{
 let liberar:(v:unknown)=>void=()=>{throw new Error("resposta ausente");};api.rpc.mockImplementation(()=>new Promise((resolve)=>{liberar=resolve;}));
 const tela=await montar(c);fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa pendente"}));
 await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(1));tela.unmount();await act(async()=>{liberar({data:c.recibo,error:null});});
 expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
it.each(casos)("$nome repete o mesmo pedido após rede incerta",async(c)=>{
 api.rpc.mockResolvedValue({data:null,error:new Error("rede")});await montar(c);
 fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa pendente"}));
 await screen.findByText(/Resultado não confirmado/);
 await waitFor(()=>expect(screen.getByRole("button",{name:"Repetir tentativa pendente"})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:"Repetir tentativa pendente"}));
 await waitFor(()=>expect(api.rpc).toHaveBeenCalledTimes(2));
 expect(api.rpc.mock.calls[1]).toEqual(api.rpc.mock.calls[0]);expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
