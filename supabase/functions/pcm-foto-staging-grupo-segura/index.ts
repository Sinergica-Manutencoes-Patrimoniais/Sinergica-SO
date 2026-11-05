import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
const url=Deno.env.get("SUPABASE_URL") ?? "";const anon=Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const privilegiado=()=>createClient(url,getSupabaseServiceKey(),{auth:{persistSession:false,autoRefreshToken:false}});
async function baixarLimitado(caminho:string):Promise<Uint8Array|null>{
  const partes=caminho.split("/");
  if(partes.some(p=>!p || p==="." || p===".." || p.includes("\\")))throw new Error("Caminho inválido");
  const chave=getSupabaseServiceKey();
  const endereco=`${url.replace(/\/+$/,"")}/storage/v1/object/authenticated/sso-levantamento-fotos/${partes.map(encodeURIComponent).join("/")}`;
  const resposta=await fetch(endereco,{headers:{Authorization:`Bearer ${chave}`,apikey:chave},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15_000)});
  if(!resposta.ok || !resposta.body){void resposta.body?.cancel().catch(()=>{});throw new Error("Storage indisponível");}
  const leitor=resposta.body.getReader();const blocos:Uint8Array[]=[];let tamanho=0;
  try{
    for(;;){
      const {done,value}=await leitor.read();if(done)break;
      tamanho+=value.byteLength;if(tamanho>10_485_760){void leitor.cancel().catch(()=>{});return null;}
      blocos.push(new Uint8Array(value));
    }
  }finally{try{leitor.releaseLock();}catch{/* Cancelamento ainda pode estar em voo. */}}
  const bytes=new Uint8Array(tamanho);let posicao=0;
  for(const bloco of blocos){bytes.set(bloco,posicao);posicao+=bloco.length;}
  return bytes;
}
serve(async(req)=>{
  const cors=corsHeaders(req.headers.get("origin"));const falha=(status:number)=>new Response(JSON.stringify({title:"Foto indisponível",status}),{status,headers:{...cors,"Content-Type":"application/problem+json","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});if(req.method!=="POST")return falha(405);
  let usuario:string;try{usuario=(await requireAuth(req)).userId;}catch{return falha(401);}
  try{
    const {data:permitido,error:limiteErro}=await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`foto-staging-grupo:${usuario}`,p_limite:60,p_janela_segundos:60});if(limiteErro || typeof permitido!=="boolean")return falha(503);if(!permitido)return falha(429);
    if(!req.body)return falha(422);const leitor=req.body.getReader();const dec=new TextDecoder("utf-8",{fatal:true});let texto="";let tamanho=0;
    let temporizador:ReturnType<typeof setTimeout>|undefined;
    const prazo=new Promise<never>((_,rejeitar)=>{temporizador=setTimeout(()=>{void leitor.cancel().catch(()=>{});rejeitar(new Error("Prazo excedido"));},10_000);});
    try{
      for(;;){const {done,value}=await Promise.race([leitor.read(),prazo]);if(done)break;tamanho+=value.byteLength;if(tamanho>4096){void leitor.cancel().catch(()=>{});return falha(413);}texto+=dec.decode(value,{stream:true});}
    }finally{if(temporizador!==undefined)clearTimeout(temporizador);try{leitor.releaseLock();}catch{/* Cancelamento ainda pode estar em voo. */}}
    let dados:unknown;try{dados=JSON.parse(texto+dec.decode());}catch{return falha(422);}
    if(!dados || typeof dados!=="object" || Array.isArray(dados) || Object.keys(dados).length!==1 || !("vinculoId" in dados) || typeof dados.vinculoId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dados.vinculoId))return falha(422);
    const vinculoId=dados.vinculoId;const cliente=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("authorization") ?? ""}},auth:{persistSession:false,autoRefreshToken:false}});
    const mediado=Deno.env.get("SSO_FOTO_GRUPO_MEDIADA_ENABLED")==="true";
    const resolver=async()=>{
      if(!mediado){const {data,error}=await cliente.schema("pcm").rpc("sso_caminho_foto_staging_grupo",{p_vinculo_id:vinculoId});if(error?.code==="42501")return null;if(error || typeof data!=="string")throw new Error("consulta");return {caminho:data,identidade:data};}
      const autorizacao=await cliente.schema("pcm").rpc("sso_autorizar_foto_grupo_mediada",{p_ator_id:usuario,p_vinculo_id:vinculoId});
      if(autorizacao.error?.code==="42501")return null;if(autorizacao.error || autorizacao.data!==true)throw new Error("consulta");
      const local=await privilegiado().schema("pcm").rpc("sso_localizar_foto_grupo_servico",{p_vinculo_id:vinculoId});
      if(local.error || !Array.isArray(local.data) || local.data.length!==1)throw new Error("consulta");
      const item=local.data[0];
      if(!item || typeof item.caminho!=="string" || !item.caminho || typeof item.objeto_id!=="string" || typeof item.foto_id!=="string" || typeof item.objeto_atualizado_em!=="string" || !Number.isFinite(Date.parse(item.objeto_atualizado_em)))throw new Error("consulta");
      return {caminho:item.caminho,identidade:JSON.stringify([item.caminho,item.objeto_id,item.foto_id,item.objeto_atualizado_em])};
    };
    const origem=await resolver();if(!origem)return falha(404);
    let bytes:Uint8Array;
    if(mediado){const recebido=await baixarLimitado(origem.caminho);if(!recebido)return falha(413);bytes=recebido;}
    else {const {data:arquivo,error}=await privilegiado().storage.from("sso-levantamento-fotos").download(origem.caminho);if(error || !arquivo)return falha(503);if(arquivo.size>10485760)return falha(413);bytes=new Uint8Array(await arquivo.arrayBuffer());}
    const jpeg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;const png=bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);if(!jpeg && !png)return falha(415);const final=await resolver();if(!final || final.identidade!==origem.identidade)return falha(404);
    return new Response(bytes,{headers:{...cors,"Content-Type":jpeg ? "image/jpeg" : "image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
  }catch{return falha(503);}
});
