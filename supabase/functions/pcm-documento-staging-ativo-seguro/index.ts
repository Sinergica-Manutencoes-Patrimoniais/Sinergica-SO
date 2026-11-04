import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
const url=Deno.env.get("SUPABASE_URL") ?? "";const anon=Deno.env.get("SUPABASE_ANON_KEY") ?? "";const privilegiado=()=>createClient(url,getSupabaseServiceKey(),{auth:{persistSession:false,autoRefreshToken:false}});
serve(async(req)=>{
  const cors=corsHeaders(req.headers.get("origin"));const falha=(status:number)=>new Response(JSON.stringify({title:"Documento indisponível",status}),{status,headers:{...cors,"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});if(req.method!=="POST")return falha(405);
  let usuario:string;try{usuario=(await requireAuth(req)).userId;}catch{return falha(401);}
  try{const {data:permitido,error:limiteErro}=await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`documento-staging-ativo:${usuario}`,p_limite:60,p_janela_segundos:60});if(limiteErro || typeof permitido!=="boolean")return falha(503);if(!permitido)return falha(429);
    if(!req.body)return falha(422);const leitor=req.body.getReader();const dec=new TextDecoder("utf-8",{fatal:true});let texto="";let tamanho=0;
    for(;;){const {done,value}=await leitor.read();if(done)break;tamanho+=value.byteLength;if(tamanho>4096){void leitor.cancel().catch(()=>{});return falha(413);}texto+=dec.decode(value,{stream:true});}
    let dados:unknown;try{dados=JSON.parse(texto+dec.decode());}catch{return falha(422);}
    if(!dados || typeof dados!=="object" || Array.isArray(dados) || Object.keys(dados).length!==1 || !("vinculoId" in dados) || typeof dados.vinculoId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dados.vinculoId))return falha(422);
    const vinculoId=dados.vinculoId;const cliente=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization") ?? ""}},auth:{persistSession:false,autoRefreshToken:false}});
    const resolver=async()=>{const {data,error}=await cliente.schema("pcm").rpc("sso_caminho_documento_staging_ativo",{p_vinculo_id:vinculoId});if(error?.code==="42501")return null;if(error || typeof data!=="string")throw new Error("consulta");return data;};
    const caminho=await resolver();if(!caminho)return falha(404);const {data:arquivo,error}=await privilegiado().storage.from("sso-levantamento-documentos").download(caminho);if(error || !arquivo)return falha(503);if(arquivo.size>10485760)return falha(413);
    const bytes=new Uint8Array(await arquivo.arrayBuffer());if(bytes.length<5 || ![37,80,68,70,45].every((v,i)=>bytes[i]===v))return falha(415);if(await resolver()!==caminho)return falha(404);
    return new Response(bytes,{headers:{...cors,"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=\"documento.pdf\"","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
  }catch{return falha(503);}
});
