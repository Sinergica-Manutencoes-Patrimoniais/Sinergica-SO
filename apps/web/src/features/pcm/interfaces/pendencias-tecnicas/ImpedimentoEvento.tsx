import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function ImpedimentoEvento({userId,clienteId,chamadoId,revisao}:{userId:string;clienteId:string;chamadoId:string;revisao:number}){
  const ativo=import.meta.env.VITE_SSO_HISTORICO_IMPEDIMENTO_ENABLED==="true";
  const q=useQuery({queryKey:["suspensao-chamado",userId,clienteId,chamadoId,"impedimento",revisao],enabled:ativo,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_impedimento_suspensao",{p_chamado_id:chamadoId,p_revision:revisao}).abortSignal(signal);if(error)throw error;const r=z.object({chamadoId:z.string().uuid(),revision:z.number().int().positive(),impedimento:z.string().nullable()}).strict().parse(data);if(r.chamadoId!==chamadoId || r.revision!==revisao)throw new Error("Evento divergente");return r;}});
  if(!ativo)return null;
  if(q.isPending)return <span> · Consultando impedimento…</span>;
  if(q.isError)return <span role="alert"> · Impedimento indisponível <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></span>;
  return <span> · Impedimento: {q.data.impedimento ?? "não registrado"}</span>;
}
