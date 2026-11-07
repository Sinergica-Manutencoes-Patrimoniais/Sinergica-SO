// Não implantar ou habilitar até testes integrados e revisão adversarial (ADR-0806).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, requireAuth } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { ConflitoRequest, PrazoExcedido, criarIngestaoDigest } from "./ingestao-digest.ts";
import { criarAdaptador } from "./adapter.ts";
import { criarLeituraLimitadaStorage } from "./storage-limitado.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
async function aguardarComPrazo<T>(operacao: PromiseLike<T>): Promise<T> {
  let prazo: ReturnType<typeof setTimeout> | undefined;
  const expiracao = new Promise<never>((_, rejeitar) => { prazo = setTimeout(() => rejeitar(new PrazoExcedido("resultado_incerto")), 15_000); });
  try { return await Promise.race([Promise.resolve(operacao), expiracao]); }
  finally { if (prazo !== undefined) clearTimeout(prazo); }
}
serve(async req => {
  const base = corsHeaders(req.headers.get("origin"));
  const cors = { ...base, "Access-Control-Allow-Headers": `${base["Access-Control-Allow-Headers"]}, x-request-id, x-despesa-id` };
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
  if (Deno.env.get("SSO_COMPROVANTE_INGESTAO_HABILITADA") !== "true") return new Response(null,{status:503,headers:cors});
  const chaveServico=getSupabaseServiceKey();
  const cliente=createClient(url,chaveServico,{auth:{persistSession:false,autoRefreshToken:false}});
  const baixarLimitado=criarLeituraLimitadaStorage(url,chaveServico);
  const adapter=criarAdaptador({
    rpc:async(operacao,args)=>{const {data,error}=await aguardarComPrazo(operacao==="recuperar"
      ? cliente.schema("pcm").rpc("sso_recuperar_upload_comprovante_servico",{p_usuario_id:args.p_usuario_id,p_request_id:args.p_request_id,p_despesa_id:args.p_despesa_id,p_digest:args.p_digest})
      : cliente.schema("pcm").rpc("sso_ingestao_comprovante_servico",{p_operacao:operacao,...args}));if(error){if(error.code==="23505"&&error.message==="request_id_conflitante")throw new ConflitoRequest();throw error;}return data;},
    upload:async(caminho,bytes,tipo,upsert)=>{const {data,error}=await aguardarComPrazo(cliente.storage.from("sso-despesas-visita").upload(caminho,bytes,{contentType:tipo,upsert}));if(error||!data||typeof data.id!=="string"||typeof data.path!=="string")throw new Error("upload_indisponivel");return {id:data.id,path:data.path};},
    download:baixarLimitado,
  });
  const handler=criarIngestaoDigest({
    ...adapter,
    recuperarPendente:Deno.env.get("SSO_RECUPERAR_UPLOAD_COMPROVANTE_ENABLED")==="true"?adapter.recuperarPendente:undefined,
    autenticar:async(r)=>({usuario:(await aguardarComPrazo(requireAuth(r))).userId}),
    habilitado:async()=>Deno.env.get("SSO_COMPROVANTE_INGESTAO_HABILITADA")==="true",
    limitar:async({usuario})=>{const {data,error}=await aguardarComPrazo(cliente.schema("atendimento").rpc("fn_consumir_rate_limit_webhook",{p_chave:`comprovante-ingestao:${usuario}`,p_limite:20,p_janela_segundos:60}));if(error||typeof data!=="boolean")throw new Error("limite_indisponivel");return data;},
  });
  const resposta=await handler(req), headers=new Headers(resposta.headers);
  for(const [chave,valor] of Object.entries(cors))headers.set(chave,valor);
  return new Response(resposta.body,{status:resposta.status,headers});
});
