import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function RevisaoCondicaoResolvida({userId,clienteId,pendenciaId,revisao}:{userId:string;clienteId:string;pendenciaId:string;revisao:number}){
  const ativo=import.meta.env.VITE_SSO_REVISAO_CONDICAO_RESOLVIDA_ENABLED==="true";
  const q=useQuery({queryKey:["pendencias-tecnicas",userId,clienteId,pendenciaId,"revisao-condicao-resolvida",revisao],enabled:ativo,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_revisao_condicao_resolvida",{p_pendencia_id:pendenciaId}).abortSignal(signal);if(error)throw error;const r=z.object({pendenciaId:z.string().guid(),revision:z.number().int().positive(),estado:z.enum(["nao_resolvida","indeterminada","condicao_alterada","sem_alteracao"])}).strict().parse(data);if(r.pendenciaId!==pendenciaId || r.revision!==revisao)throw new Error("Revisão divergente");return r;}});
  if(!ativo)return null;
  if(q.isPending)return <p>Conferindo condição da resolução…</p>;
  if(q.isError)return <p role="alert">Conferência indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>;
  if(q.data.estado==="condicao_alterada")return <p role="alert">A condição técnica mudou após a resolução. Avalie e registre reabertura explícita no comando de decisão; o estado não foi alterado automaticamente.</p>;
  if(q.data.estado==="indeterminada")return <p role="alert">Não foi possível comparar a condição da resolução. Revise o histórico antes de decidir.</p>;
  return null;
}
