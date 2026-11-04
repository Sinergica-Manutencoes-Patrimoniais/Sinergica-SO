import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function PreviaFotosDestino({userId,clienteId,loteId,chave}:{userId:string;clienteId:string;loteId:string;chave:string}){
  const ativo=import.meta.env.VITE_SSO_PREVIA_FOTOS_DESTINO_ENABLED==="true";
  const q=useQuery({queryKey:["levantamentos",userId,clienteId,loteId,chave,"previa-fotos"],enabled:ativo,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_previa_fotos_destino",{p_lote_id:loteId,p_chave:chave}).abortSignal(signal);if(error)throw error;const r=z.object({loteId:z.string().uuid(),chave:z.string(),tipo:z.string(),linhaIncorporada:z.boolean(),fotosStaging:z.number().int().nonnegative()}).strict().parse(data);if(r.loteId!==loteId || r.chave!==chave)throw new Error("Prévia divergente");return r;}});
  if(!ativo)return null;
  if(q.isPending)return <p>Consultando destino de fotos…</p>;
  if(q.isError)return <p role="alert">Prévia de fotos indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>;
  return <p>{q.data.fotosStaging} foto(s) no levantamento; {q.data.linhaIncorporada ? "há fato de incorporação ou vínculo para a linha" : "não há fato de incorporação ou vínculo nesta fonte"}. Esta consulta não distingue criação de vínculo nem representa aprovação ou publicação de fotos; o vínculo ao cadastro oficial permanece indisponível.</p>;
}
