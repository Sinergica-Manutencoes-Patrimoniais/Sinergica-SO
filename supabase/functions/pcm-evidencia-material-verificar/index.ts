import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const url=Deno.env.get("SUPABASE_URL")??"",anon=Deno.env.get("SUPABASE_ANON_KEY")??"";
serve(async(req)=>{
 const cors=corsHeaders(req.headers.get("origin"));const erro=(status:number)=>new Response(JSON.stringify({title:"Verificação indisponível",status}),{status,headers:{...cors,"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});if(req.method!=="POST")return erro(405);
 let usuario:string;try{usuario=(await requireAuth(req)).userId;}catch{return erro(401);}
 try{
  if(Deno.env.get("SSO_EVIDENCIA_MATERIAL_VERIFICADA_ENABLED")!=="true")return erro(503);
  const chave=getSupabaseServiceKey();const service=createClient(url,chave,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:permitido,error:limiteErro}=await service.schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`verificar-material:${usuario}`,p_limite:30,p_janela_segundos:60});if(limiteErro||typeof permitido!=="boolean")return erro(503);if(!permitido)return erro(429);
  if(!req.body)return erro(422);const leitor=req.body.getReader();const dec=new TextDecoder("utf-8",{fatal:true});let texto="",tamanho=0;
  for(;;){const {done,value}=await leitor.read();if(done)break;tamanho+=value.byteLength;if(tamanho>8192){void leitor.cancel().catch(()=>{});return erro(413);}texto+=dec.decode(value,{stream:true});}
  let entrada:unknown;try{entrada=JSON.parse(texto+dec.decode());}catch{return erro(422);}
  if(!entrada||typeof entrada!=="object"||Array.isArray(entrada))return erro(422);const p=entrada as Record<string,unknown>;
  if(Object.keys(p).sort().join(",")!==["clienteId","digest","eventoRevision","listaId","nome","objetoId","requestId","tipo"].sort().join(",")||![p.clienteId,p.listaId,p.objetoId,p.requestId].every(v=>typeof v==="string"&&uuid.test(v))||typeof p.eventoRevision!=="number"||!Number.isSafeInteger(p.eventoRevision)||p.eventoRevision<1||typeof p.nome!=="string"||typeof p.digest!=="string"||!/^[a-f0-9]{64}$/.test(p.digest)||!["image/jpeg","image/png"].includes(String(p.tipo)))return erro(422);
  const partes=p.nome.split("/");if(partes.length!==4||partes[0]!==p.clienteId||partes[1]!==p.listaId||partes[2]!==String(p.eventoRevision)||!uuid.test(partes[3]!))return erro(422);
  const cliente=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization")??""}},auth:{persistSession:false,autoRefreshToken:false}});
  const contexto={p_ator_id:usuario,p_cliente_id:p.clienteId,p_lista_id:p.listaId,p_evento_revision:p.eventoRevision};
  const {data:objeto,error:resolverErro}=await cliente.schema("pcm").rpc("sso_resolver_upload_material_mediado",{...contexto,p_nome:p.nome});if(resolverErro||objeto!==p.objetoId)return erro(404);
  const {data:info,error:infoErro}=await service.schema("pcm").rpc("sso_info_objeto_material_servico",{...contexto,p_objeto_id:objeto});
  if(infoErro||!info||info.objetoId!==objeto||info.nome!==p.nome||typeof info.atualizadoEm!=="string")return erro(503);
  const base=new URL(url);if(!["http:","https:"].includes(base.protocol)||base.username||base.password||base.search||base.hash)return erro(503);
  const arquivo=await fetch(`${base.toString().replace(/\/+$/,"")}/storage/v1/object/authenticated/sso-material-evidencias/${partes.map(encodeURIComponent).join("/")}`,{headers:{Authorization:`Bearer ${chave}`,apikey:chave},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15_000)});if(!arquivo.ok||!arquivo.body)return erro(503);
  const stream=arquivo.body.getReader(),pedacos:Uint8Array[]=[];let total=0;for(;;){const {done,value}=await stream.read();if(done)break;total+=value.byteLength;if(total>10485760){void stream.cancel().catch(()=>{});return erro(413);}pedacos.push(value);}
  const bytes=new Uint8Array(total);let pos=0;for(const parte of pedacos){bytes.set(parte,pos);pos+=parte.length;}
  const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);const tipo=jpeg?"image/jpeg":png?"image/png":null;
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");if(!tipo||tipo!==p.tipo||digest!==p.digest)return erro(422);
  const {error:atestoErro}=await service.schema("pcm").rpc("sso_atestar_material_servico",{...contexto,p_request_id:p.requestId,p_objeto_id:objeto,p_digest:digest,p_mime:tipo,p_metadata:info.metadata,p_atualizado_em:info.atualizadoEm});if(atestoErro)return erro(503);
  const {data:resultado,error:vinculoErro}=await cliente.schema("pcm").rpc("sso_vincular_evidencia_material_mediada",{...contexto,p_request_id:p.requestId,p_objeto_id:objeto});if(vinculoErro||!resultado||resultado.requestId!==p.requestId||resultado.listaId!==p.listaId||resultado.eventoRevision!==p.eventoRevision||typeof resultado.evidenciaId!=="string"||!uuid.test(resultado.evidenciaId))return erro(503);
  return new Response(JSON.stringify(resultado),{headers:{...cors,"Content-Type":"application/json","Cache-Control":"private, no-store"}});
 }catch{return erro(503);}
});
