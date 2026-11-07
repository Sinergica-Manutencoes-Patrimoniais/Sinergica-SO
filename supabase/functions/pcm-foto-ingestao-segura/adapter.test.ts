import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarAdaptador } from "./adapter.ts";
import { criarHandler } from "./handler.ts";
const usuario="17950000-0000-4000-8000-000000000001",lote="17950000-0000-4000-8000-000000000002",request="17950000-0000-4000-8000-000000000003",objeto="17950000-0000-4000-8000-000000000004",foto="17950000-0000-4000-8000-000000000005",cliente="17950000-0000-4000-8000-000000000006";
const nome=`${cliente}/${lote}/${objeto}`,png=new Uint8Array([137,80,78,71,13,10,26,10]);
Deno.test("adapta reserva, upload não sobrescrito e releitura à confirmação",async()=>{
 const etapas:string[]=[];
 const transporte={autenticar:async()=>({usuario}),limitar:async()=>true,habilitado:async()=>true,
  rpc:async(operacao:string,args:Record<string,unknown>)=>{etapas.push(operacao);if(operacao==="autorizar")return true;if(operacao==="reservar")return {estado:"nova",digest:args.p_digest,nome};return {fotoId:foto};},
  upload:async(caminho:string,_bytes:Uint8Array,tipo:string,upsert:boolean)=>{assertEquals(caminho,nome);assertEquals(tipo,"image/png");assertEquals(upsert,false);etapas.push("upload");return {id:objeto,path:nome};},
  download:async(caminho:string)=>{assertEquals(caminho,nome);etapas.push("download");return png;}};
 const handler=criarHandler(criarAdaptador(transporte));
 const resposta=await handler(new Request("http://localhost",{method:"POST",headers:{"x-request-id":request,"x-lote-id":lote,"x-linha-chave":"a"},body:png}));
 assertEquals(resposta.status,200);assertEquals(await resposta.json(),{fotoId:foto,requestId:request});assertEquals(etapas,["autorizar","reservar","upload","download","autorizar","confirmar"]);
});
Deno.test("falhas e divergência de Storage não confirmam",async()=>{
 let confirmacoes=0;
 const transporte={autenticar:async()=>({usuario}),limitar:async()=>true,habilitado:async()=>true,
  rpc:async(operacao:string,args:Record<string,unknown>)=>{if(operacao==="autorizar")return true;if(operacao==="reservar")return {estado:"nova",digest:args.p_digest,nome};confirmacoes++;return {fotoId:foto};},
  upload:async()=>({id:objeto,path:nome}),download:async()=>new Uint8Array([1,2,3])};
 const req=()=>new Request("http://localhost",{method:"POST",headers:{"x-request-id":request,"x-lote-id":lote,"x-linha-chave":"a"},body:png});
 assertEquals((await criarHandler(criarAdaptador(transporte))(req())).status,409);
 assertEquals((await criarHandler(criarAdaptador({...transporte,upload:async()=>{throw new Error("falha");}}))(req())).status,503);
 assertEquals((await criarHandler(criarAdaptador({...transporte,upload:async()=>({id:objeto,path:"outra"})}))(req())).status,503);
 assertEquals(confirmacoes,0);
});
Deno.test("recupera reserva no mesmo nome e confirma sem sobrescrever",async()=>{
 let uploads=0,confirmacoes=0;
 const transporte={autenticar:async()=>({usuario}),limitar:async()=>true,habilitado:async()=>true,
  rpc:async(operacao:string,args:Record<string,unknown>)=>{if(operacao==="autorizar")return true;if(operacao==="reservar")return {estado:"pendente",digest:args.p_digest,nome};if(operacao==="recuperar")return {objetoId:objeto,nome};confirmacoes++;return {fotoId:foto};},
  upload:async()=>{uploads++;return {id:objeto,path:nome};},download:async()=>png};
 const req=()=>new Request("http://localhost",{method:"POST",headers:{"x-request-id":request,"x-lote-id":lote,"x-linha-chave":"a"},body:png});
 assertEquals((await criarHandler(criarAdaptador(transporte))(req())).status,200);assertEquals(uploads,0);assertEquals(confirmacoes,1);
});
Deno.test("corrida com upload ainda ausente permanece pendente, repetição posterior reconcilia",async()=>{
 let presente=false,uploads=0,confirmacoes=0;
 const transporte={autenticar:async()=>({usuario}),limitar:async()=>true,habilitado:async()=>true,
  rpc:async(operacao:string,args:Record<string,unknown>)=>{if(operacao==="autorizar")return true;if(operacao==="reservar")return {estado:"pendente",digest:args.p_digest,nome};if(operacao==="recuperar")return presente?{objetoId:objeto,nome}:null;if(operacao==="observar")return {registrado:true};confirmacoes++;return {fotoId:foto};},
  upload:async()=>{uploads++;return {id:objeto,path:nome};},download:async()=>png};
 const req=()=>new Request("http://localhost",{method:"POST",headers:{"x-request-id":request,"x-lote-id":lote,"x-linha-chave":"a"},body:png});
 assertEquals((await criarHandler(criarAdaptador(transporte))(req())).status,409);assertEquals(confirmacoes,0);
 presente=true;assertEquals((await criarHandler(criarAdaptador(transporte))(req())).status,200);assertEquals(confirmacoes,1);assertEquals(uploads,0);
});
Deno.test("ausência incerta registra conferência sem concluir nem reenviar",async()=>{
 let uploads=0,confirmacoes=0,observacoes=0;
 const transporte={autenticar:async()=>({usuario}),limitar:async()=>true,habilitado:async()=>true,
  rpc:async(operacao:string,args:Record<string,unknown>)=>{if(operacao==="autorizar")return true;if(operacao==="reservar")return {estado:"pendente",digest:args.p_digest,nome};if(operacao==="recuperar")return null;if(operacao==="observar") {observacoes++;return {registrado:true};}confirmacoes++;return {fotoId:foto};},
  upload:async()=>{uploads++;return {id:objeto,path:nome};},download:async()=>png};
 const req=new Request("http://localhost",{method:"POST",headers:{"x-request-id":request,"x-lote-id":lote,"x-linha-chave":"a"},body:png});
 assertEquals((await criarHandler(criarAdaptador(transporte))(req)).status,409);assertEquals(observacoes,1);assertEquals(uploads,0);assertEquals(confirmacoes,0);
});
Deno.test("revogação após releitura bloqueia confirmação pendente",async()=>{
 let permissoes=0,confirmacoes=0;
 const transporte={autenticar:async()=>({usuario}),limitar:async()=>true,habilitado:async()=>true,
  rpc:async(operacao:string,args:Record<string,unknown>)=>{if(operacao==="autorizar")return ++permissoes===1;if(operacao==="reservar")return {estado:"pendente",digest:args.p_digest,nome};if(operacao==="recuperar")return {objetoId:objeto,nome};confirmacoes++;return {fotoId:foto};},
  upload:async()=>({id:objeto,path:nome}),download:async()=>png};
 const req=new Request("http://localhost",{method:"POST",headers:{"x-request-id":request,"x-lote-id":lote,"x-linha-chave":"a"},body:png});
 assertEquals((await criarHandler(criarAdaptador(transporte))(req)).status,404);assertEquals(confirmacoes,0);
});
