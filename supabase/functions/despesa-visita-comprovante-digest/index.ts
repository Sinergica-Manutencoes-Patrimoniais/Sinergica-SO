// Não implantar ou habilitar antes da revisão e testes integrados ADR-0816.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarLeituraDigest } from "../despesa-visita-comprovante-seguro/leitura-digest.ts";
import { criarLeituraLimitadaStorage } from "../pcm-comprovante-ingestao/storage-limitado.ts";
const url=Deno.env.get("SUPABASE_URL")??"";
serve(async req=>{
 const base=corsHeaders(req.headers.get("origin")),cors={...base,"Access-Control-Allow-Headers":`${base["Access-Control-Allow-Headers"]}, x-despesa-id`};
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(Deno.env.get("SSO_COMPROVANTE_LEITURA_DIGEST_HABILITADA")!=="true")return new Response(null,{status:503,headers:cors});
 const chave=getSupabaseServiceKey(),cliente=createClient(url,chave,{auth:{persistSession:false,autoRefreshToken:false}}), caminhos=new Map<string,string>(),lerArquivo=criarLeituraLimitadaStorage(url,chave);
 const handler=criarLeituraDigest({
  autenticar:async(r)=>({usuario:(await requireAuth(r)).userId}),
  habilitado:async()=>Deno.env.get("SSO_COMPROVANTE_LEITURA_DIGEST_HABILITADA")==="true",
  limitar:async({usuario})=>{const {data,error}=await cliente.schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`comprovante-digest:${usuario}`,p_limite:60,p_janela_segundos:60});if(error||typeof data!=="boolean")throw new Error("limite_indisponivel");return data;},
  resolver:async({usuario},despesaId)=>{const {data,error}=await cliente.schema("pcm").rpc("sso_comprovante_digest_servico",{p_usuario_id:usuario,p_despesa_id:despesaId});if(error?.code==="42501")return null;if(error||!data||typeof data.objetoId!=="string"||typeof data.caminho!=="string"||typeof data.digest!=="string")throw new Error("resolucao_indisponivel");const partes=data.caminho.split("/");if(partes.length!==3||partes[1]!==despesaId||!partes.every((x:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)))throw new Error("caminho_invalido");const anterior=caminhos.get(data.objetoId);if(anterior&&anterior!==data.caminho)return null;caminhos.set(data.objetoId,data.caminho);return {objetoId:data.objetoId,digest:data.digest};},
  baixar:async(objetoId)=>{const caminho=caminhos.get(objetoId);if(!caminho)throw new Error("objeto_desconhecido");return await lerArquivo(caminho);},
 });
 const resposta=await handler(req),headers=new Headers(resposta.headers);for(const [chave,valor] of Object.entries(cors))headers.set(chave,valor);return new Response(resposta.body,{status:resposta.status,headers});
});
