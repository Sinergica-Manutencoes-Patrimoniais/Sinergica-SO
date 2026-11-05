import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { criarHandler } from "./handler.ts";

const url=Deno.env.get("SUPABASE_URL") ?? "";
const privilegiado=()=>createClient(url,getSupabaseServiceKey(),{auth:{persistSession:false,autoRefreshToken:false}});
serve(criarHandler({
  cors:corsHeaders,
  identidade:async(req)=>{const usuario=(await requireAuth(req)).userId;const token=req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];if(!token)throw new Error();const parte=token.split(".")[1];if(!parte)throw new Error();const base64=parte.replace(/-/g,"+").replace(/_/g,"/");const claims:unknown=JSON.parse(atob(base64.padEnd(Math.ceil(base64.length/4)*4,"=")));if(!claims || typeof claims!=="object" || !("sub" in claims) || claims.sub!==usuario || !("user_role" in claims) || typeof claims.user_role!=="string" || !claims.user_role || claims.user_role.length>100)throw new Error();return {usuario,userRole:claims.user_role};},
  limitar:async(usuario)=>{const {data,error}=await privilegiado().schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`foto-equipamento:${usuario}`,p_limite:60,p_janela_segundos:60});if(error || typeof data!=="boolean")throw new Error();return data;},
  resolver:async(id,identidade)=>{const {data,error}=await privilegiado().schema("pcm").rpc("sso_caminho_foto_equipamento_servico_v2",{p_vinculo_id:id,p_usuario_id:identidade.usuario,p_user_role:identidade.userRole});if(error?.code==="42501")return null;if(error || typeof data!=="string")throw new Error();return data;},
  baixar:async(caminho)=>{const {data,error}=await privilegiado().storage.from("sso-levantamento-fotos").download(caminho);if(error || !data)throw new Error();return data;},
}));
