import { criarAdaptador } from "./adapter.ts";
const u="18090000-0000-4000-8000-000000000001",d="18090000-0000-4000-8000-000000000002",o="18090000-0000-4000-8000-000000000003",p={requestId:u,despesaId:d};
const assert=(x:boolean)=>{if(!x)throw new Error("Asserção falhou");};
Deno.test("adapter transmite identidade, reserva e confirmação com upload sem sobrescrita",async()=>{
 const chamadas:unknown[]=[];const a=criarAdaptador({rpc:async(op,args)=>{chamadas.push([op,args]);return op==="reservar"?{estado:"nova",digest:"a".repeat(64),clienteId:u,caminho:`${u}/${d}/${u}`}:{objetoId:o};},upload:async(c,_b,_t,upsert)=>{assert(!upsert);return{id:o,path:c};},download:async()=>new Uint8Array([1])});
 const r=await a.reservar({usuario:u},p,"a".repeat(64));assert(r.estado==="nova");const arquivo=await a.subirNovo(new Uint8Array([1]),"image/png",r.caminho!);assert(arquivo.objetoId===o);assert((await a.baixar(o))[0]===1);await a.confirmar({usuario:u},p,"a".repeat(64),o);assert(chamadas.length===2);
});
Deno.test("adapter recusa resposta ou caminho divergente e não baixa id desconhecido",async()=>{
 const a=criarAdaptador({rpc:async()=>({estado:"nova",digest:"x"}),upload:async()=>({id:o,path:"divergente"}),download:async()=>new Uint8Array([1])});
 let falhas=0;try{await a.reservar({usuario:u},p,"a".repeat(64));}catch{falhas++;}try{await a.subirNovo(new Uint8Array([1]),"image/png","esperado");}catch{falhas++;}try{await a.baixar(o);}catch{falhas++;}assert(falhas===3);
});
Deno.test("adapter de recuperação usa apenas objeto e caminho da reserva confirmada",async()=>{
 const chamadas:string[]=[];
 const a=criarAdaptador({
  rpc:async(op)=>{chamadas.push(op);return op==="recuperar"?{estado:"recuperavel",digest:"a".repeat(64),clienteId:u,caminho:`${u}/${d}/${u}`,objetoId:o}:{objetoId:o};},
  upload:async()=>{throw new Error("upload não esperado");},download:async(c)=>{assert(c===`${u}/${d}/${u}`);return new Uint8Array([1]);},
 });
 const recuperado=await a.recuperarPendente!({usuario:u},p,"a".repeat(64));
 assert(recuperado.estado==="recuperavel"&&recuperado.objetoId===o);
 assert((await a.baixar(o))[0]===1);await a.confirmar({usuario:u},p,"a".repeat(64),o);
 assert(chamadas.join(",")==="recuperar,confirmar");
});
Deno.test("recuperação recusa caminho ou digest incompatível",async()=>{
 let baixou=0;
 const a=criarAdaptador({rpc:async()=>({estado:"recuperavel",digest:"b".repeat(64),clienteId:u,caminho:`${u}/${d}/${u}`,objetoId:o}),
  upload:async()=>({id:o,path:""}),download:async()=>{baixou++;return new Uint8Array();}});
 let recusou=false;try{await a.recuperarPendente!({usuario:u},p,"a".repeat(64));}catch{recusou=true;}
 assert(recusou&&baixou===0);
});
