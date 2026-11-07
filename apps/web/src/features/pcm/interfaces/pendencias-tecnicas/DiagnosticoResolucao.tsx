import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function DiagnosticoResolucao({userId,clienteId,pendenciaId,revisao}:{userId:string;clienteId:string;pendenciaId:string;revisao:number}){
  const ativo=import.meta.env.VITE_SSO_DIAGNOSTICO_RESOLUCAO_PENDENCIA_ENABLED==="true";
  const q=useQuery({queryKey:["pendencias-tecnicas",userId,clienteId,pendenciaId,"diagnostico-resolucao",revisao],enabled:ativo,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_diagnostico_resolucao_pendencia",{p_pendencia_id:pendenciaId}).abortSignal(signal);if(error)throw error;const r=z.object({pendenciaId:z.string().guid(),revision:z.number().int().positive(),estado:z.string(),parcelaVinculada:z.boolean(),osAtribuida:z.boolean(),osFinalizada:z.boolean()}).strict().parse(data);if(r.pendenciaId!==pendenciaId)throw new Error("Pendência divergente");return r;}});
  if(!ativo)return null;
  if(q.isPending)return <p>Consultando diagnóstico…</p>;
  if(q.isError)return <p role="alert">Diagnóstico indisponível ou sem permissão. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>;
  return <p>Parcela {q.data.parcelaVinculada ? "vinculada" : "não vinculada"}; OS {q.data.osAtribuida ? "atribuída" : "não atribuída"}{q.data.osFinalizada ? " e finalizada" : ""}. Isso não comprova correção da condição técnica; eventual resolução exige evidência e atestação PCM no comando próprio.</p>;
}
