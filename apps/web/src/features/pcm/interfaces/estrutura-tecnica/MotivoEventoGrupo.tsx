import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

export function MotivoEventoGrupo({userId,clienteId,grupoId,eventoId}:{userId:string;clienteId:string;grupoId:string;eventoId:string}){
  const resultado=useQuery({queryKey:["estrutura-tecnica",userId,clienteId,"historico",grupoId,"motivo",eventoId],enabled:import.meta.env.VITE_SSO_MOTIVOS_HISTORICO_GRUPO_ENABLED==="true",gcTime:0,queryFn:async({signal})=>{
    const {data,error}=await supabase.schema("pcm").rpc("sso_motivos_historico_grupo",{p_grupo_id:grupoId,p_eventos:[eventoId]}).abortSignal(signal);if(error)throw error;
    const rows=z.array(z.object({evento_id:z.string().guid(),operacao:z.enum(["movimentacao","reclassificacao","quantidade"]),motivo:z.string()}).strict()).max(1).parse(data);
    if(rows.some(r=>r.evento_id!==eventoId))throw new Error("Evento divergente");return rows[0] ?? null;
  }});
  if(import.meta.env.VITE_SSO_MOTIVOS_HISTORICO_GRUPO_ENABLED!=="true")return null;
  if(resultado.isPending)return <p>Consultando motivo…</p>;
  if(resultado.isError)return <p role="alert">Motivo indisponível. <button type="button" onClick={()=>void resultado.refetch()}>Tentar novamente</button></p>;
  if(!resultado.data)return null;
  return <p>{resultado.data.operacao==="movimentacao" ? "Movimentação" : resultado.data.operacao==="reclassificacao" ? "Reclassificação" : "Alteração de quantidade"} · Motivo: {resultado.data.motivo}</p>;
}
