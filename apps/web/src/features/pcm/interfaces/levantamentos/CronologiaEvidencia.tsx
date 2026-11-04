import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function CronologiaEvidencia({userId,clienteId,tipo,anexoId}:{userId:string;clienteId:string;tipo:"foto"|"documento";anexoId:string}){
  const ativo=import.meta.env.VITE_SSO_CRONOLOGIA_EVIDENCIA_ENABLED==="true";
  const q=useQuery({queryKey:["levantamentos",userId,clienteId,"cronologia-evidencia",tipo,anexoId],enabled:ativo,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_cronologia_evidencia_linha",{p_tipo:tipo,p_anexo_id:anexoId}).abortSignal(signal);if(error)throw error;const r=z.object({tipo:z.enum(["foto","documento"]),anexoId:z.string().uuid(),edicoesPosteriores:z.number().int().nonnegative(),empates:z.number().int().nonnegative()}).strict().parse(data);if(r.tipo!==tipo || r.anexoId!==anexoId)throw new Error("Cronologia divergente");return r;}});
  if(!ativo)return null;
  if(q.isPending)return <p>Consultando cronologia…</p>;
  if(q.isError)return <p role="alert">Cronologia indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>;
  return <p>{q.data.edicoesPosteriores>0 ? `Há ${q.data.edicoesPosteriores} edição(ões) registrada(s) após o vínculo deste anexo.` : "Não há edição posterior registrada."} {q.data.empates>0 && "Há eventos com o mesmo horário; ordem inconclusiva."} A cronologia do SSO não comprova data de produção nem pertinência da evidência.</p>;
}
