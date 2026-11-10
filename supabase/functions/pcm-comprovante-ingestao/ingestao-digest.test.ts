import { ConflitoRequest, criarIngestaoDigest, type Dependencias } from "./ingestao-digest.ts";
const usuario="18090000-0000-4000-8000-000000000001", despesa="18090000-0000-4000-8000-000000000002", objeto="18090000-0000-4000-8000-000000000003";
const bytes=new Uint8Array([37,80,68,70,45,49]);
const req=()=>new Request("http://localhost",{method:"POST",headers:{"x-request-id":usuario,"x-despesa-id":despesa,"x-digest":"inverificavel"},body:bytes});
const deps=():Dependencias=>({autenticar:async()=>({usuario}),habilitado:async()=>true,limitar:async()=>true,autorizar:async()=>true,reservar:async(_i,_p,digest)=>({estado:"nova",digest,caminho:`${usuario}/${despesa}/${usuario}`,clienteId:usuario}),subirNovo:async()=>({objetoId:objeto}),baixar:async()=>bytes,confirmar:async(_i,_p,_d,id)=>({objetoId:id})});
const assert=(v:boolean)=>{if(!v)throw new Error("Asserção falhou");};
Deno.test("digest vem dos bytes e só confirma após conferência",async()=>{const d=deps();let esperado="",confirmado="";d.reservar=async(_i,_p,digest)=>{esperado=digest;return{estado:"nova",digest,clienteId:usuario,caminho:`${usuario}/${despesa}/${usuario}`};};d.confirmar=async(_i,_p,digest,id)=>{confirmado=digest;return{objetoId:id};};assert((await criarIngestaoDigest(d)(req())).status===200);assert(esperado===confirmado&&esperado!=="inverificavel"&&/^[a-f0-9]{64}$/.test(esperado));});
Deno.test("armazenamento divergente e revogação impedem confirmação",async()=>{const d=deps();let n=0;d.confirmar=async(_i,_p,_digest,id)=>{n++;return{objetoId:id};};d.baixar=async()=>new Uint8Array([1]);assert((await criarIngestaoDigest(d)(req())).status===409);d.baixar=async()=>bytes;let a=0;d.autorizar=async()=>++a===1;assert((await criarIngestaoDigest(d)(req())).status===404);assert(n===0);});
Deno.test("reserva incerta não causa novo upload",async()=>{const d=deps();let n=0;d.subirNovo=async()=>{n++;return{objetoId:objeto};};d.reservar=async(_i,_p,digest)=>({estado:"pendente",digest});assert((await criarIngestaoDigest(d)(req())).status===409&&n===0);});
Deno.test("limite e gate impedem até reserva",async()=>{const d=deps();let n=0;d.reservar=async(_i,_p,digest)=>{n++;return{estado:"pendente",digest};};d.limitar=async()=>false;assert((await criarIngestaoDigest(d)(req())).status===429);d.habilitado=async()=>false;assert((await criarIngestaoDigest(d)(req())).status===503&&n===0);});
Deno.test("replay concluído confere bytes e não faz novo upload",async()=>{const d=deps();let n=0;d.reservar=async(_i,_p,digest)=>({estado:"concluida",digest,clienteId:usuario,caminho:`${usuario}/${despesa}/${usuario}`,objetoId:objeto});d.subirNovo=async()=>{n++;return{objetoId:objeto};};assert((await criarIngestaoDigest(d)(req())).status===200&&n===0);d.baixar=async()=>new Uint8Array([1]);assert((await criarIngestaoDigest(d)(req())).status===409&&n===0);});
Deno.test("conflito estruturado retorna 409, erro desconhecido continua 503",async()=>{const d=deps();d.reservar=async()=>{throw new ConflitoRequest();};assert((await criarIngestaoDigest(d)(req())).status===409);d.reservar=async()=>{throw new Error("falha indisponível");};assert((await criarIngestaoDigest(d)(req())).status===503);});
Deno.test("corpo incompleto expira antes de reservar ou enviar ao Storage",async()=>{
  const d=deps();d.prazoLeituraMs=5;let reservas=0,uploads=0;
  d.reservar=async(_i,_p,digest)=>{reservas++;return{estado:"pendente",digest};};
  d.subirNovo=async()=>{uploads++;return{objetoId:objeto};};
  const corpo=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(bytes);}});
  const pedido=new Request("http://localhost",{method:"POST",headers:{"x-request-id":usuario,"x-despesa-id":despesa},body:corpo});
  assert((await criarIngestaoDigest(d)(pedido)).status===408);
  assert(reservas===0&&uploads===0);
});
Deno.test("recupera objeto pendente apenas após conferir bytes e autorização",async()=>{
  const d=deps();let uploads=0,confirmacoes=0;
  d.reservar=async(_i,_p,digest)=>({estado:"pendente",digest});
  d.recuperarPendente=async(_i,_p,digest)=>({estado:"recuperavel",digest,clienteId:usuario,caminho:`${usuario}/${despesa}/${usuario}`,objetoId:objeto});
  d.subirNovo=async()=>{uploads++;return{objetoId:objeto};};
  d.confirmar=async(_i,_p,_digest,id)=>{confirmacoes++;return{objetoId:id};};
  assert((await criarIngestaoDigest(d)(req())).status===200&&uploads===0&&confirmacoes===1);
  d.baixar=async()=>new Uint8Array([1]);
  assert((await criarIngestaoDigest(d)(req())).status===409&&uploads===0&&confirmacoes===1);
  d.baixar=async()=>bytes;let chamadas=0;d.autorizar=async()=>++chamadas===1;
  assert((await criarIngestaoDigest(d)(req())).status===404&&uploads===0&&confirmacoes===1);
});
Deno.test("reserva pendente sem objeto não gera novo upload",async()=>{
  const d=deps();let uploads=0;
  d.reservar=async(_i,_p,digest)=>({estado:"pendente",digest});
  d.recuperarPendente=async(_i,_p,digest)=>({estado:"pendente",digest});
  d.subirNovo=async()=>{uploads++;return{objetoId:objeto};};
  assert((await criarIngestaoDigest(d)(req())).status===409&&uploads===0);
});
Deno.test("cancelamento após reserva não inicia upload",async()=>{
  const d=deps(), controle=new AbortController(); let uploads=0;
  d.reservar=async(_i,_p,digest)=>{controle.abort();return{estado:"nova",digest,clienteId:usuario,caminho:`${usuario}/${despesa}/${usuario}`};};
  d.subirNovo=async()=>{uploads++;return{objetoId:objeto};};
  const pedido=new Request("http://localhost",{method:"POST",headers:{"x-request-id":usuario,"x-despesa-id":despesa},body:bytes,signal:controle.signal});
  assert((await criarIngestaoDigest(d)(pedido)).status===408&&uploads===0);
});
Deno.test("cancelamento após upload preserva reserva sem confirmar",async()=>{
  const d=deps(), controle=new AbortController(); let confirmacoes=0;
  d.subirNovo=async()=>{controle.abort();return{objetoId:objeto};};
  d.confirmar=async(_i,_p,_digest,id)=>{confirmacoes++;return{objetoId:id};};
  const pedido=new Request("http://localhost",{method:"POST",headers:{"x-request-id":usuario,"x-despesa-id":despesa},body:bytes,signal:controle.signal});
  assert((await criarIngestaoDigest(d)(pedido)).status===408&&confirmacoes===0);
});
