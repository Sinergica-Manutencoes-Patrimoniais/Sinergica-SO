import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
const url=Deno.env.get("SUPABASE_URL") ?? "";
const privilegiado=()=>createClient(url,getSupabaseServiceKey(),{auth:{persistSession:false,autoRefreshToken:false}});
serve(async(req)=>{
  const cors=corsHeaders(req.headers.get("origin"));const falha=(status:number)=>new Response(JSON.stringify({title:"Foto indisponível",status}),{status,headers:{...cors,"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});if(req.method!=="POST")return falha(405);
  let usuario:string;let userRole:string;try{usuario=(await requireAuth(req)).userId;const token=req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];if(!token)throw new Error();const parte=token.split('.')[1];if(!parte)throw new Error();const base64=parte.replace(/-/g,'+').replace(/_/g,'/');const claims:unknown=JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,'=')));if(!claims || typeof claims!=='object' || !('sub' in claims) || claims.sub!==usuario || !('user_role' in claims) || typeof claims.user_role!=='string' || !claims.user_role || claims.user_role.length>100)throw new Error();userRole=claims.user_role;}catch{return falha(401);}
  try{
    const {data:permitido,error:limiteErro}=await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`foto-staging-ativo:${usuario}`,p_limite:60,p_janela_segundos:60});if(limiteErro || typeof permitido!=="boolean")return falha(503);if(!permitido)return falha(429);
    if(!req.body)return falha(422);const leitor=req.body.getReader();const dec=new TextDecoder("utf-8",{fatal:true});let texto="";let tamanho=0;
    for(;;){const {done,value}=await leitor.read();if(done)break;tamanho+=value.byteLength;if(tamanho>4096){void leitor.cancel().catch(()=>{});return falha(413);}texto+=dec.decode(value,{stream:true});}
    let dados:unknown;try{dados=JSON.parse(texto+dec.decode());}catch{return falha(422);}
    if(!dados || typeof dados!=="object" || Array.isArray(dados) || Object.keys(dados).length!==1 || !("vinculoId" in dados) || typeof dados.vinculoId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dados.vinculoId))return falha(422);
    const vinculoId=dados.vinculoId;
    const resolver=async()=>{const {data,error}=await privilegiado().schema("pcm").rpc("sso_caminho_foto_staging_ativo_servico",{p_vinculo_id:vinculoId,p_usuario_id:usuario,p_user_role:userRole});if(error?.code==="42501")return null;if(error || typeof data!=="string")throw new Error("consulta");return data;};
    const caminho=await resolver();if(!caminho)return falha(404);const {data:arquivo,error}=await privilegiado().storage.from("sso-levantamento-fotos").download(caminho);if(error || !arquivo)return falha(503);if(arquivo.size>10485760)return falha(413);
    const bytes=new Uint8Array(await arquivo.arrayBuffer());const jpeg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;const png=bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);if(!jpeg && !png)return falha(415);try{if((await requireAuth(req)).userId!==usuario)return falha(401);}catch{return falha(401);}if(await resolver()!==caminho)return falha(404);try{if((await requireAuth(req)).userId!==usuario)return falha(401);}catch{return falha(401);}
    return new Response(bytes,{headers:{...cors,"Content-Type":jpeg ? "image/jpeg" : "image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
  }catch{return falha(503);}
});
