// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AlterarDiaContratual } from "./AlterarDiaContratual";
import { AlterarDiaComVisitas } from "./AlterarDiaComVisitas";
import { FeriadosDeclarados } from "./FeriadosDeclarados";
const api=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),alterar:vi.fn()}));
vi.mock("../../../../lib/supabase-client",()=>({supabase:{auth:{getUser:api.getUser},schema:()=>({rpc:api.rpc})}}));
vi.mock("../../infrastructure/supabase-calendario-contratual-adapter",()=>({alterarDiaContratual:api.alterar}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const usuario=id(1),cliente=id(2),serie=id(3),request=id(4),nova=id(5);
const auth=(u=usuario)=>({data:{user:{id:u}},error:null});
const regra={id:id(6),serieId:serie,contratoId:id(7),numero:1,ancoraSemana:"2026-11-02",diaSemana:5,intervaloSemanas:1,horaInicio:"09:00",duracaoMinutos:60,deslocamentoMinutos:0,fuso:"America/Sao_Paulo",vigenciaInicio:"2026-01-01",vigenciaFim:null};
const onUsar=vi.fn();
const casos=[
 {nome:"dia",chave:`sso-calendario-alteracao:${JSON.stringify([usuario,cliente,serie])}`,pedido:{requestId:request,serieId:serie,regraNovaId:nova,expectedRevision:1,diaSemana:2,vigencia:"2026-12-01"},elemento:(u:string)=><AlterarDiaContratual userId={u} clienteId={cliente} regra={regra} />,recibo:undefined},
 {nome:"dia com Visitas",chave:`sso-mudanca-dia-visitas:${JSON.stringify([usuario,cliente,serie])}`,pedido:{requestId:request,atorId:usuario,clienteId:cliente,serieId:serie,regraNovaId:nova,expectedRevision:1,diaSemana:2,vigencia:"2026-12-01",revisoes:[],tentativaIncerta:true},elemento:(u:string)=><AlterarDiaComVisitas key={u} userId={u} clienteId={cliente} serieId={serie} revisao={1} dia={2} vigencia="2026-12-01" bloqueado={false} />,recibo:{data:{requestId:request,serieId:serie,regraId:nova,revision:2,visitasMovidas:0,efeitoRemoto:false},error:null}},
 {nome:"feriado",chave:`sso-feriado-declarado:${JSON.stringify([usuario,cliente])}`,pedido:{requestId:request,clienteId:cliente,id:id(8),revision:0,acao:"declarar",contratoId:null,data:"2026-12-25",fonte:"Calendário",motivo:"Feriado"},elemento:(u:string)=><FeriadosDeclarados userId={u} clienteId={cliente} contratos={[]} onUsar={onUsar} />,recibo:{data:{requestId:request,feriadoId:id(8),revision:1,ativo:true},error:null}},
];
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();api.getUser.mockResolvedValue(auth());});
afterEach(()=>{cleanup();vi.unstubAllEnvs();sessionStorage.clear();});
it.each(casos)("$nome preserva tentativa sem enviar quando sessão mudou",async(c)=>{
 sessionStorage.setItem(c.chave,JSON.stringify(c.pedido));api.getUser.mockResolvedValue(auth(id(9)));
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 render(<QueryClientProvider client={client}>{c.elemento(usuario)}</QueryClientProvider>);
 fireEvent.click(screen.getByRole("button",{name:"Repetir mesmo pedido"}));
 await screen.findByText(/não confirmad/i);
 expect(api.rpc).not.toHaveBeenCalled();expect(api.alterar).not.toHaveBeenCalled();expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
});
it.each(casos)("$nome preserva tentativa quando contexto muda durante resposta",async(c)=>{
 sessionStorage.setItem(c.chave,JSON.stringify(c.pedido));let liberar:(valor:unknown)=>void=()=>{throw new Error("envio ausente");};
 const aguardar=()=>new Promise((resolve)=>{liberar=resolve;});
 if(c.nome==="dia")api.alterar.mockImplementation(aguardar);else api.rpc.mockImplementation(aguardar);
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 const tela=render(<QueryClientProvider client={client}>{c.elemento(usuario)}</QueryClientProvider>);
 fireEvent.click(screen.getByRole("button",{name:"Repetir mesmo pedido"}));
 await waitFor(()=>expect(c.nome==="dia"?api.alterar:api.rpc).toHaveBeenCalledTimes(1));
 tela.rerender(<QueryClientProvider client={client}>{c.elemento(id(9))}</QueryClientProvider>);
 await act(async()=>{liberar(c.recibo);});
 expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
 expect(screen.queryByText(/Nova regra registrada|Declaração registrada|Regra alterada/)).toBeNull();
 if(c.nome==="feriado")expect(onUsar).not.toHaveBeenCalled();
});

it("repete alteração de dia com o mesmo pedido após resposta incerta",async()=>{
 const c=casos[0];if (!c) throw new Error("Cenário ausente");sessionStorage.setItem(c.chave,JSON.stringify(c.pedido));
 api.alterar.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(undefined);
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 render(<QueryClientProvider client={client}>{c.elemento(usuario)}</QueryClientProvider>);
 fireEvent.click(screen.getByRole("button",{name:"Repetir mesmo pedido"}));
 await screen.findByText(/não confirmad/i);
 expect(sessionStorage.getItem(c.chave)).toBe(JSON.stringify(c.pedido));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Repetir mesmo pedido"})).toBeEnabled());
 fireEvent.click(screen.getByRole("button",{name:"Repetir mesmo pedido"}));
 await waitFor(()=>expect(sessionStorage.getItem(c.chave)).toBeNull());
 expect(api.alterar).toHaveBeenCalledTimes(2);
 expect(api.alterar.mock.calls[1]).toEqual(api.alterar.mock.calls[0]);
});
