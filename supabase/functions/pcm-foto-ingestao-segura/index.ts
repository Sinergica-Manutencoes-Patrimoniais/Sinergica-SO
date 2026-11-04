import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler } from "./handler.ts";
import { criarAdaptador } from "./adapter.ts";
import { cabecalhosFotos } from "./cors.ts";

const url=Deno.env.get("SUPABASE_URL") ?? "";
serve(async(req)=>{
 const cors=cabecalhosFotos(corsHeaders(req.headers.get("origin")));
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 const cliente=createClient(url,getSupabaseServiceKey(),{auth:{persistSession:false,autoRefreshToken:false}});
 const handler=criarHandler(criarAdaptador({
  autenticar:async(r)=>({usuario:(await requireAuth(r)).userId}),
  habilitado:async()=>Deno.env.get("SSO_FOTO_INGESTAO_HABILITADA")==="true",
  limitar:async({usuario})=>{const {data,error}=await cliente.schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`foto-ingestao:${usuario}`,p_limite:20,p_janela_segundos:60});if(error||typeof data!=="boolean")throw new Error("limite_indisponivel");return data;},
  rpc:async(operacao,args)=>{const {data,error}=operacao==="recuperar"
    ?await cliente.schema("pcm").rpc("sso_recuperar_objeto_ingestao_servico",{p_usuario_id:args.p_usuario_id,p_request_id:args.p_request_id,p_lote_id:args.p_lote_id,p_chave:args.p_chave,p_digest:args.p_digest})
    :operacao==="observar"?await cliente.schema("pcm").rpc("sso_observar_ingestao_pendente_servico",{p_usuario_id:args.p_usuario_id,p_request_id:args.p_request_id,p_lote_id:args.p_lote_id,p_chave:args.p_chave,p_digest:args.p_digest})
    :await cliente.schema("pcm").rpc("sso_ingestao_foto_servico",{p_operacao:operacao,...args});if(error)throw error;return data;},
  upload:async(nome,bytes,tipo,upsert)=>{const {data,error}=await cliente.storage.from("sso-levantamento-fotos").upload(nome,bytes,{contentType:tipo,upsert});if(error||!data||typeof data.id!=="string"||typeof data.path!=="string")throw new Error("upload_indisponivel");return {id:data.id,path:data.path};},
  download:async(nome)=>{const {data,error}=await cliente.storage.from("sso-levantamento-fotos").download(nome);if(error||!data||data.size>10485760)throw new Error("download_indisponivel");return new Uint8Array(await data.arrayBuffer());},
 }));
 const resposta=await handler(req);const headers=new Headers(resposta.headers);for(const [chave,valor] of Object.entries(cors))headers.set(chave,valor);
 return new Response(resposta.body,{status:resposta.status,headers});
});
