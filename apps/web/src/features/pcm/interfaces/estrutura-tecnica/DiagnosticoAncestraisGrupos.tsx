import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
export function DiagnosticoAncestraisGrupos({userId,clienteId}:{userId:string;clienteId:string}){
  const ativo=import.meta.env.VITE_SSO_DIAGNOSTICO_ANCESTRAIS_GRUPOS_ENABLED==="true";
  const q=useInfiniteQuery({queryKey:["estrutura-tecnica",userId,clienteId,"diagnostico-ancestrais-grupos"],enabled:ativo,gcTime:0,initialPageParam:null as string | null,queryFn:async({pageParam,signal})=>{
    const {data,error}=await supabase.schema("pcm").rpc("sso_diagnostico_ancestrais_grupos",{p_cliente_id:clienteId,p_apos:pageParam,p_limite:100}).abortSignal(signal);if(error)throw error;
    const r=z.object({clienteId:z.string().uuid(),examinados:z.number().int().min(0).max(100),ciclos:z.number().int().nonnegative(),incompletos:z.number().int().nonnegative(),limite:z.number().int().nonnegative(),ultimoId:z.string().uuid().nullable()}).strict().parse(data);
    if(r.clienteId!==clienteId || r.ciclos+r.incompletos+r.limite>r.examinados || (r.examinados>0 && !r.ultimoId))throw new Error("Diagnóstico divergente");return r;
  },getNextPageParam:p=>p.examinados===100 ? p.ultimoId ?? undefined : undefined});
  if(!ativo)return null;
  const paginas=q.data?.pages ?? [];const totais=paginas.reduce((a,p)=>({examinados:a.examinados+p.examinados,ciclos:a.ciclos+p.ciclos,incompletos:a.incompletos+p.incompletos,limite:a.limite+p.limite}),{examinados:0,ciclos:0,incompletos:0,limite:0});
  return <section aria-label="Diagnóstico de ancestrais de Grupos"><h4>Diagnóstico de ancestrais</h4>{q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}{q.data && <p>{totais.examinados} Grupo(s) examinados: {totais.ciclos} com ciclo; {totais.incompletos} com caminho incompleto; {totais.limite} excedem o limite de profundidade. {q.hasNextPage ? "Resultado parcial." : "Todas as páginas foram consultadas."} Os dados podem mudar durante a consulta.</p>}{q.hasNextPage && <button type="button" disabled={q.isFetching} onClick={()=>void q.fetchNextPage()}>Examinar próxima página</button>}</section>;
}
