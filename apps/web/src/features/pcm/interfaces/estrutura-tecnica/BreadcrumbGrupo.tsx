import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function BreadcrumbGrupo({userId,clienteId,grupoId}:{userId:string;clienteId:string;grupoId:string}){
  const ativo=import.meta.env.VITE_SSO_BREADCRUMB_GRUPO_ENABLED==="true";
  const q=useQuery({queryKey:["estrutura-tecnica",userId,clienteId,"breadcrumb-grupo",grupoId],enabled:ativo,gcTime:0,queryFn:async({signal})=>{
    const conferir=async()=>{const sessao=await supabase.auth.getUser();if(sessao.error||sessao.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");};
    await conferir();
    const {data,error}=await supabase.schema("pcm").rpc("sso_breadcrumb_grupo_mediado",{p_ator_id:userId,p_cliente_id:clienteId,p_grupo_id:grupoId}).abortSignal(signal);if(error)throw error;
    const r=z.object({grupoId:z.string().uuid(),clienteId:z.string().uuid(),estado:z.enum(["disponivel","indisponivel","ciclo","limite"]),caminho:z.array(z.string()).max(65)}).strict().parse(data);if(r.grupoId!==grupoId || r.clienteId!==clienteId || (r.estado==="disponivel" && r.caminho.length<2) || (r.estado!=="disponivel" && r.caminho.length!==0))throw new Error("Caminho divergente");await conferir();return r;
  }});
  if(!ativo)return null;
  if(q.isPending||q.isFetching)return <span> · Consultando caminho…</span>;
  if(q.isError)return <span> · Caminho indisponível <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></span>;
  if(q.data.estado!=="disponivel")return <span role="alert"> · Hierarquia inválida ou indisponível ({q.data.estado})</span>;
  return <span> · Caminho: {q.data.caminho.join(" / ")}</span>;
}
