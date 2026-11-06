import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarLeitura } from "../pcm-foto-ingestao-segura/leitura.ts";
import { criarAdaptadorLeitura } from "../pcm-foto-ingestao-segura/adapter-leitura.ts";
import { cabecalhosFotos } from "../pcm-foto-ingestao-segura/cors.ts";

const url=Deno.env.get("SUPABASE_URL") ?? "";
serve(async(req)=>{
 const cors=cabecalhosFotos(corsHeaders(req.headers.get("origin")));
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 const cliente=createClient(url,getSupabaseServiceKey(),{auth:{persistSession:false,autoRefreshToken:false}});
 const handler=criarLeitura(criarAdaptadorLeitura({
  autenticar:async(r)=>({usuario:(await requireAuth(r)).userId}),
  habilitado:async()=>Deno.env.get("SSO_FOTO_INGESTAO_HABILITADA")==="true",
  limitar:async({usuario})=>{const {data,error}=await cliente.schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`foto-leitura-digest:${usuario}`,p_limite:60,p_janela_segundos:60});if(error||typeof data!=="boolean")throw new Error("limite_indisponivel");return data;},
  resolver:async(usuario,fotoId)=>{const {data,error}=await cliente.schema("pcm").rpc("sso_resolver_foto_digest_servico",{p_usuario_id:usuario,p_foto_id:fotoId});if(error?.code==="42501")return null;if(error)throw error;return data;},
  download:async(nome)=>{const {data,error}=await cliente.storage.from("sso-levantamento-fotos").download(nome);if(error||!data||data.size>10485760)throw new Error("download_indisponivel");return new Uint8Array(await data.arrayBuffer());},
 }));
 const resposta=await handler(req);const headers=new Headers(resposta.headers);for(const [chave,valor] of Object.entries(cors))headers.set(chave,valor);
 return new Response(resposta.body,{status:resposta.status,headers});
});
