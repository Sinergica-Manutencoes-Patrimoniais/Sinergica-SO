import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

const url=Deno.env.get("SUPABASE_URL") ?? "";const anon=Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const privilegiado=()=>createClient(url,getSupabaseServiceKey(),{auth:{persistSession:false,autoRefreshToken:false}});
async function baixarLimitado(caminho:string):Promise<Uint8Array>{
  const partes=caminho.split("/");const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(partes.length!==4||!uuid.test(partes[0]!)||!uuid.test(partes[1]!)||!/^[1-9][0-9]{0,8}$/.test(partes[2]!)||!uuid.test(partes[3]!))throw new Error("caminho_invalido");
  const base=new URL(url);if(!["http:","https:"].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw new Error("storage_indisponivel");
  const chave=getSupabaseServiceKey();const resposta=await fetch(`${base.toString().replace(/\/+$/,"")}/storage/v1/object/authenticated/sso-material-evidencias/${partes.map(encodeURIComponent).join("/")}`,{headers:{Authorization:`Bearer ${chave}`,apikey:chave},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15_000)});
  if(!resposta.ok||!resposta.body)throw new Error("arquivo_indisponivel");
  const leitor=resposta.body.getReader();const pedacos:Uint8Array[]=[];let total=0;
  for(;;){const {done,value}=await leitor.read();if(done)break;total+=value.byteLength;if(total>10485760){void leitor.cancel().catch(()=>{});throw new Error("arquivo_excedido");}pedacos.push(value);}
  const bytes=new Uint8Array(total);let pos=0;for(const parte of pedacos){bytes.set(parte,pos);pos+=parte.length;}return bytes;
}
serve(async(req)=>{
  const cors=corsHeaders(req.headers.get("origin"));const falha=(status:number)=>new Response(JSON.stringify({title:"Evidência indisponível",status}),{status,headers:{...cors,"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});if(req.method!=="POST")return falha(405);
  let usuario:string;try{usuario=(await requireAuth(req)).userId;}catch{return falha(401);}
  try{
    const {data:permitido,error:limiteErro}=await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`evidencia-material:${usuario}`,p_limite:60,p_janela_segundos:60});
    if(limiteErro || typeof permitido!=="boolean")return falha(503);if(!permitido)return falha(429);if(!req.body)return falha(422);
    const leitor=req.body.getReader();const dec=new TextDecoder("utf-8",{fatal:true});let texto="";let tamanho=0;
    for(;;){const {done,value}=await leitor.read();if(done)break;tamanho+=value.byteLength;if(tamanho>4096){void leitor.cancel().catch(()=>{});return falha(413);}texto+=dec.decode(value,{stream:true});}
    let dados:unknown;try{dados=JSON.parse(texto+dec.decode());}catch{return falha(422);}
    if(!dados || typeof dados!=="object" || Array.isArray(dados) || Object.keys(dados).length!==1 || !("evidenciaId" in dados) || typeof dados.evidenciaId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dados.evidenciaId))return falha(422);
    const evidenciaId=dados.evidenciaId;const cliente=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization") ?? ""}},auth:{persistSession:false,autoRefreshToken:false}});
    const mediado=Deno.env.get("SSO_EVIDENCIA_MATERIAL_DOWNLOAD_MEDIADO_ENABLED")==="true";
    const resolver=async()=>{const {data,error}=mediado?await privilegiado().schema("pcm").rpc("sso_caminho_evidencia_material_servico",{p_usuario_id:usuario,p_evidencia_id:evidenciaId}):await cliente.schema("pcm").rpc("sso_caminho_evidencia_material",{p_evidencia_id:evidenciaId});if(error?.code==="42501")return null;if(error || typeof data!=="string")throw new Error("consulta");return data;};
    const caminho=await resolver();if(!caminho)return falha(404);const bytes=await baixarLimitado(caminho);
    const jpeg=bytes.length>=3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff;const png=bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    if(!jpeg && !png)return falha(415);if(await resolver()!==caminho)return falha(404);
    return new Response(bytes,{headers:{...cors,"Content-Type":jpeg ? "image/jpeg" : "image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
  }catch{return falha(503);}
});
