import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const schema=z.object({evento_id:z.string().guid(),tipo:z.enum(["atribuicao","interrupcao"]),os_id:z.string().guid(),estado:z.string().nullable(),motivo:z.string().nullable(),ator_id:z.string().guid(),ocorrido_em:z.string().datetime({offset:true})}).strict();
export function HistoricoParcela({userId,clienteId,parcelaId}:{userId:string;clienteId:string;parcelaId:string}){
  const [aberto,setAberto]=useState(false);const consulta=useInfiniteQuery({queryKey:["backlog-interrupcoes",userId,clienteId,parcelaId,"historico"],enabled:aberto,gcTime:0,initialPageParam:null as {em:string;id:string} | null,
    queryFn:async({pageParam,signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_historico_parcela_os",{p_parcela_id:parcelaId,p_apos_em:pageParam?.em ?? null,p_apos_id:pageParam?.id ?? null,p_limite:20}).abortSignal(signal);if(error)throw error;return z.array(schema).max(20).parse(data);},
    getNextPageParam:(p)=>{const u=p.at(-1);return p.length===20 && u ? {em:u.ocorrido_em,id:u.evento_id} : undefined;}});
  return <section><button type="button" onClick={()=>setAberto((v)=>!v)}>{aberto ? "Ocultar histórico" : "Ver histórico administrativo"}</button>
    {aberto && <><p>Registros de atribuição e declarações, não comprovação de execução ou parada.</p>{consulta.isPending && <output>Consultando histórico…</output>}{consulta.isError && <p role="alert">Não foi possível consultar histórico. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isError && consulta.data?.pages.flat().length===0 && <p>Sem eventos registrados.</p>}{!consulta.isError && <ul>{consulta.data?.pages.flat().map((e)=><li key={e.evento_id}>{new Date(e.ocorrido_em).toLocaleString("pt-BR")} · {e.tipo} {e.estado ?? ""} · OS {e.os_id} · responsável {e.ator_id} · {e.motivo ?? "motivo indisponível"}</li>)}</ul>}
      {consulta.hasNextPage && <button type="button" disabled={consulta.isFetchingNextPage} onClick={()=>void consulta.fetchNextPage()}>Mais eventos</button>}</>}
  </section>;
}
