import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarHandler } from "./handler.ts";
const requestId="17880000-0000-4000-8000-000000000001",loteId="17880000-0000-4000-8000-000000000002",fotoId="17880000-0000-4000-8000-000000000003";
const png=new Uint8Array([137,80,78,71,13,10,26,10]);
const nomeReservado=`17880000-0000-4000-8000-000000000004/${loteId}/17880000-0000-4000-8000-000000000005`;
const req=(dados:Uint8Array=png)=>new Request("http://localhost/",{method:"POST",headers:{"x-request-id":requestId,"x-lote-id":loteId,"x-linha-chave":"linha"},body:Uint8Array.from(dados).buffer});
Deno.test("limite nega antes de ler bytes ou iniciar reserva",async()=>{
 let reservas=0;const deps={habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),limitar:async()=>false,autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>{reservas++;return{estado:"nova" as const,digest};},subirNovo:async()=>({objetoId:"o"}),lerObjeto:async()=>png,confirmar:async()=>({fotoId})};
 assertEquals((await criarHandler(deps)(req())).status,429);assertEquals(reservas,0);
 assertEquals((await criarHandler({...deps,limitar:async()=>{throw new Error("indisponível");}})(req())).status,503);assertEquals(reservas,0);
});
Deno.test("upload utiliza exclusivamente o nome reservado pelo banco",async()=>{
  let nomeRecebido="";
  const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"nova" as const,digest,nome:nomeReservado}),subirNovo:async(_b:Uint8Array,_t:string,nome:string)=>{nomeRecebido=nome;return {objetoId:"o"};},lerObjeto:async()=>png,confirmar:async()=>({fotoId})};
  assertEquals((await criarHandler(deps)(req())).status,200);assertEquals(nomeRecebido,nomeReservado);
});
Deno.test("nome reservado ausente, malformado ou de outro lote não inicia upload",async()=>{
  let uploads=0;
  const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"nova" as const,digest}),subirNovo:async()=>{uploads++;return {objetoId:"o"};},lerObjeto:async()=>png,confirmar:async()=>({fotoId})};
  assertEquals((await criarHandler(deps)(req())).status,503);
  assertEquals((await criarHandler({...deps,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"nova" as const,digest,nome:"../../outro"})})(req())).status,503);
  assertEquals((await criarHandler({...deps,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"nova" as const,digest,nome:`${requestId}/${requestId}/${fotoId}`})})(req())).status,503);
  assertEquals(uploads,0);
});
Deno.test("flag ou permissão negada impede armazenamento",async()=>{
  let uploads=0;const deps={limitar:async()=>true,habilitado:async()=>false,autenticar:async()=>({usuario:"u"}),autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"nova" as const,digest}),subirNovo:async()=>{uploads++;return{objetoId:"o"};},lerObjeto:async()=>png,confirmar:async()=>({fotoId})};
  assertEquals((await criarHandler(deps)(req())).status,503);
  assertEquals((await criarHandler({...deps,limitar:async()=>true,habilitado:async()=>true,autorizar:async()=>false})(req())).status,404);assertEquals(uploads,0);
});
Deno.test("ingestão verifica bytes e reautoriza antes de confirmar",async()=>{
  let autorizacoes=0;let confirmacoes=0;let hashCalculado="";
  const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),autorizar:async()=>{autorizacoes++;return true;},reservar:async(_i:unknown,_p:unknown,digest:string)=>{hashCalculado=digest;return{estado:"nova" as const,digest,nome:nomeReservado};},subirNovo:async(bytes:Uint8Array,tipo:string)=>{assertEquals(bytes,png);assertEquals(tipo,"image/png");return{objetoId:"o"};},lerObjeto:async()=>png,confirmar:async(_i:unknown,_p:unknown,digest:string)=>{confirmacoes++;assertEquals(digest,hashCalculado);return{fotoId};}};
  const resposta=await criarHandler(deps)(req());assertEquals(resposta.status,200);assertEquals(await resposta.json(),{fotoId,requestId});assertEquals(autorizacoes,2);assertEquals(confirmacoes,1);
  const negada=await criarHandler({...deps,autorizar:async()=>++autorizacoes===3})(req());assertEquals(negada.status,404);assertEquals(confirmacoes,1);
});
Deno.test("objeto ausente ou bytes divergentes falham fechados",async()=>{
  let confirmacoes=0;const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"nova" as const,digest,nome:nomeReservado}),subirNovo:async()=>({objetoId:""}),lerObjeto:async()=>new Uint8Array([1]),confirmar:async()=>{confirmacoes++;return{fotoId};}};
  assertEquals((await criarHandler(deps)(req())).status,503);
  assertEquals((await criarHandler({...deps,subirNovo:async()=>({objetoId:"o"})})(req())).status,409);assertEquals(confirmacoes,0);
});
Deno.test("replay concluído reautoriza; request divergente e pendente não reenviam",async()=>{
  let uploads=0;const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"concluida" as const,digest,fotoId}),subirNovo:async()=>{uploads++;return{objetoId:"o"};},lerObjeto:async()=>png,confirmar:async()=>({fotoId})};
  assertEquals((await criarHandler(deps)(req())).status,200);
  assertEquals((await criarHandler({...deps,reservar:async()=>({estado:"pendente" as const,digest:"diferente"})})(req())).status,409);
  assertEquals((await criarHandler({...deps,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"pendente" as const,digest})})(req())).status,409);assertEquals(uploads,0);
});
Deno.test("reserva pendente confirma somente bytes reencontrados idênticos sem novo upload",async()=>{
 let uploads=0,confirmacoes=0;
 const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>({estado:"pendente" as const,digest,nome:nomeReservado}),recuperar:async()=>({objetoId:"o",nome:nomeReservado}),subirNovo:async()=>{uploads++;return {objetoId:"o"};},lerObjeto:async()=>png,confirmar:async()=>{confirmacoes++;return {fotoId};}};
 assertEquals((await criarHandler(deps)(req())).status,200);assertEquals(uploads,0);assertEquals(confirmacoes,1);
 assertEquals((await criarHandler({...deps,lerObjeto:async()=>new Uint8Array([1])})(req())).status,409);assertEquals(confirmacoes,1);
 assertEquals((await criarHandler({...deps,recuperar:async()=>null})(req())).status,409);assertEquals(confirmacoes,1);assertEquals(uploads,0);
});
Deno.test("rejeita tipos e limites antes de reservar",async()=>{
  let reservas=0;const deps={limitar:async()=>true,habilitado:async()=>true,autenticar:async()=>({usuario:"u"}),autorizar:async()=>true,reservar:async(_i:unknown,_p:unknown,digest:string)=>{reservas++;return{estado:"nova" as const,digest};},subirNovo:async()=>({objetoId:"o"}),lerObjeto:async()=>png,confirmar:async()=>({fotoId})};
  assertEquals((await criarHandler(deps)(req(new Uint8Array([1,2,3])))).status,415);
  assertEquals((await criarHandler(deps)(req(new Uint8Array(10485761)))).status,413);assertEquals(reservas,0);
});
