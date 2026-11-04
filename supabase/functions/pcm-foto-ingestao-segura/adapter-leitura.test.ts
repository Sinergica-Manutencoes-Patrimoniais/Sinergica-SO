import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarAdaptadorLeitura } from "./adapter-leitura.ts";
import { criarLeitura } from "./leitura.ts";
const usuario="17960000-0000-4000-8000-000000000001",foto="17960000-0000-4000-8000-000000000002",objeto="17960000-0000-4000-8000-000000000003";
const png=new Uint8Array([137,80,78,71,13,10,26,10]);
Deno.test("leitura resolve novamente e detecta bytes alterados",async()=>{
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",png)),n=>n.toString(16).padStart(2,"0")).join("");let resolucoes=0;
 const transporte={autenticar:async()=>({usuario}),limitar:async()=>true,habilitado:async()=>true,resolver:async()=>{resolucoes++;return {objetoId:objeto,nome:"privado",digest:hash};},download:async(nome:string)=>{assertEquals(nome,"privado");return png;}};
 const req=()=>new Request("http://localhost",{method:"POST",headers:{"x-foto-id":foto}});
 const resposta=await criarLeitura(criarAdaptadorLeitura(transporte))(req());assertEquals(resposta.status,200);assertEquals(resolucoes,2);
 assertEquals((await criarLeitura(criarAdaptadorLeitura({...transporte,download:async()=>new Uint8Array([1])}))(req())).status,409);
});
