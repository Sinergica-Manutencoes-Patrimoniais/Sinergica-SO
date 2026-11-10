import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarLeitura } from "./leitura.ts";
const fotoId="17880000-0000-4000-8000-000000000003",png=new Uint8Array([137,80,78,71,13,10,26,10]);
const req=()=>new Request("http://localhost/",{method:"POST",headers:{"x-foto-id":fotoId}});
async function hash(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",Uint8Array.from(bytes).buffer)),n=>n.toString(16).padStart(2,"0")).join("");}
Deno.test("limite bloqueia leitura antes de resolver ou baixar",async()=>{
 let consultas=0;const deps={habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),limitar:async()=>false,resolver:async()=>{consultas++;return null;},baixar:async()=>png};
 assertEquals((await criarLeitura(deps)(req())).status,429);assertEquals(consultas,0);
});
Deno.test("conteúdo alterado no mesmo objeto nunca é entregue",async()=>{
  const esperado=await hash(png);let chamadas=0;
  const handler=criarLeitura({limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),resolver:async()=>{chamadas++;return{objetoId:"privado",digest:esperado};},baixar:async()=>new Uint8Array([137,80,78,71,13,10,26,11])});
  const resposta=await handler(req());assertEquals(resposta.status,409);assertEquals(chamadas,1);assertEquals((await resposta.text()).includes("privado"),false);
});
Deno.test("permissão revogada após leitura impede entrega",async()=>{
  const esperado=await hash(png);let chamadas=0;
  const handler=criarLeitura({limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),resolver:async()=>++chamadas===1?{objetoId:"privado",digest:esperado}:null,baixar:async()=>png});
  const resposta=await handler(req());assertEquals(resposta.status,404);assertEquals(chamadas,2);
});
Deno.test("conteúdo válido é entregue apenas com referência estável",async()=>{
  const esperado=await hash(png);const handler=criarLeitura({limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),resolver:async()=>({objetoId:"privado",digest:esperado}),baixar:async()=>png});
  const resposta=await handler(req());assertEquals(resposta.status,200);assertEquals(resposta.headers.get("cache-control"),"private, no-store");assertEquals((await resposta.arrayBuffer()).byteLength,8);
});
Deno.test("sem digest confiável ou gate aberto não oferece leitura",async()=>{
  const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),resolver:async()=>({objetoId:"privado",digest:""}),baixar:async()=>png};
  assertEquals((await criarLeitura(deps)(req())).status,503);assertEquals((await criarLeitura({...deps,limitar:async()=>true,habilitado:async()=>false})(req())).status,503);
});
