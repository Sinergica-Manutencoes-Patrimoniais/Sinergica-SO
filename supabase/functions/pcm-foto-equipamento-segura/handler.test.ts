import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarHandler } from "./handler.ts";

const id="17850000-0000-4000-8000-000000000091";
const req=()=>new Request("http://localhost/",{method:"POST",body:JSON.stringify({vinculoId:id})});
const png=new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:"image/png"});
Deno.test("identidade inválida impede consulta e download",async()=>{
  let chamadas=0;const resposta=await criarHandler({identidade:async()=>{throw new Error("token privado");},limitar:async()=>{chamadas++;return true;},resolver:async()=>{chamadas++;return "privado";},baixar:async()=>{chamadas++;return png;},cors:()=>({})})(req());
  assertEquals(resposta.status,401);assertEquals(chamadas,0);assertEquals((await resposta.text()).includes("token privado"),false);
});
Deno.test("gate fechado ou permissão negada não permite download",async()=>{
  let downloads=0;const identidade={usuario:"u",userRole:"colaborador"};
  const resposta=await criarHandler({identidade:async()=>identidade,limitar:async()=>true,resolver:async(idRecebido,atual)=>{assertEquals(idRecebido,id);assertEquals(atual,identidade);return null;},baixar:async()=>{downloads++;return png;},cors:()=>({})})(req());
  assertEquals(resposta.status,404);assertEquals(downloads,0);
});
Deno.test("revogação após download impede bytes e caminho",async()=>{
  let chamadas=0;const caminho="cliente/segredo.png";
  const resposta=await criarHandler({identidade:async()=>({usuario:"u",userRole:"colaborador"}),limitar:async()=>true,resolver:async()=>++chamadas===1 ? caminho : null,baixar:async()=>png,cors:()=>({})})(req());
  assertEquals(resposta.status,404);assertEquals(chamadas,2);assertEquals((await resposta.text()).includes(caminho),false);
});
Deno.test("sucesso entrega bytes sem revelar caminho e falha storage não o expõe",async()=>{
  const caminho="cliente/segredo.png";const deps={identidade:async()=>({usuario:"u",userRole:"colaborador"}),limitar:async()=>true,resolver:async()=>caminho,baixar:async()=>png,cors:()=>({})};
  const sucesso=await criarHandler(deps)(req());assertEquals(sucesso.status,200);assertEquals(sucesso.headers.get("cache-control"),"private, no-store");assertEquals([...sucesso.headers.values()].some(v=>v.includes(caminho)),false);assertEquals((await sucesso.arrayBuffer()).byteLength,8);
  const falha=await criarHandler({...deps,baixar:async()=>{throw new Error(caminho);}})(req());assertEquals(falha.status,503);assertEquals((await falha.text()).includes(caminho),false);
});
Deno.test("limite, entrada inválida e campos extras impedem resolução",async()=>{
  let consultas=0;const deps={identidade:async()=>({usuario:"u",userRole:"colaborador"}),limitar:async()=>true,resolver:async()=>{consultas++;return "privado";},baixar:async()=>png,cors:()=>({})};
  const bloqueada=await criarHandler({...deps,limitar:async()=>false})(req());assertEquals(bloqueada.status,429);
  const extra=await criarHandler(deps)(new Request("http://localhost/",{method:"POST",body:JSON.stringify({vinculoId:id,caminho:"privado"})}));assertEquals(extra.status,422);
  const grande=await criarHandler(deps)(new Request("http://localhost/",{method:"POST",body:JSON.stringify({vinculoId:id})+" ".repeat(4096)}));assertEquals(grande.status,413);
  assertEquals(consultas,0);
});
Deno.test("rejeita arquivo não reconhecido e arquivo acima do limite",async()=>{
  let consultas=0;const deps={identidade:async()=>({usuario:"u",userRole:"colaborador"}),limitar:async()=>true,resolver:async()=>{consultas++;return "privado";},baixar:async()=>new Blob(["<html>"],{type:"image/png"}),cors:()=>({})};
  const invalida=await criarHandler(deps)(req());assertEquals(invalida.status,415);assertEquals(consultas,1);
  consultas=0;const grande=await criarHandler({...deps,baixar:async()=>new Blob([new Uint8Array(10*1024*1024+1)])})(req());assertEquals(grande.status,413);assertEquals(consultas,1);
});
