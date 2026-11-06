import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function DiagnosticoVinculosGrupos({userId,clienteId}:{userId:string;clienteId:string}){
  const ativo=import.meta.env.VITE_SSO_DIAGNOSTICO_VINCULOS_GRUPOS_ENABLED==="true";
  const q=useQuery({queryKey:["estrutura-tecnica",userId,clienteId,"diagnostico-vinculos-grupos"],enabled:ativo,gcTime:0,queryFn:async({signal})=>{
    const {data,error}=await supabase.schema("pcm").rpc("sso_diagnostico_vinculos_grupos",{p_cliente_id:clienteId}).abortSignal(signal);if(error)throw error;
    const r=z.object({clienteId:z.string().uuid(),totalGrupos:z.number().int().nonnegative(),localOuAreaIndisponivel:z.number().int().nonnegative(),sistemaIndisponivel:z.number().int().nonnegative()}).strict().parse(data);if(r.clienteId!==clienteId || r.localOuAreaIndisponivel>r.totalGrupos || r.sistemaIndisponivel>r.totalGrupos)throw new Error("Diagnóstico divergente");return r;
  }});
  if(!ativo)return null;
  return <section aria-label="Diagnóstico de vínculos de Grupos"><h4>Diagnóstico de vínculos</h4>{q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}{q.data && <p>{q.data.totalGrupos} Grupo(s) ativo(s); {q.data.localOuAreaIndisponivel} com Local ou Área indisponível; {q.data.sistemaIndisponivel} com Sistema indisponível. Um Grupo pode constar nas duas contagens. Não verifica ciclos de ancestrais.</p>}</section>;
}
