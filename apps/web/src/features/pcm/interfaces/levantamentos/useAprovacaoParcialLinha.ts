import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function useAprovacaoParcialLinha(userId:string,clienteId:string,loteId:string,chave:string,revisao:number){
 return useQuery({queryKey:["levantamentos",userId,clienteId,loteId,chave,"aprovacao-parcial-vigente",revisao],enabled:import.meta.env.VITE_SSO_APROVACAO_PARCIAL_ENABLED==="true",gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_retrato_aprovacao_autorizado",{p_lote_id:loteId,p_chave:chave}).abortSignal(signal);if(error)throw error;const r=z.object({loteId:z.string().uuid(),chave:z.string(),revision:z.number().int(),aprovacaoParcialVigente:z.boolean(),previsaoNaoAprova:z.literal(true)}).passthrough().parse(data);if(r.loteId!==loteId || r.chave!==chave || r.revision!==revisao)throw new Error("Revisão divergente");return r.aprovacaoParcialVigente;}});
}
