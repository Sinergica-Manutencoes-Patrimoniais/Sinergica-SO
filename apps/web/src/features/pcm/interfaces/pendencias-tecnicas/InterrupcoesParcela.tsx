import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DeclararInterrupcao } from "./DeclararInterrupcao";
import { HistoricoParcela } from "./HistoricoParcela";
const schema=z.object({os_id:z.string().uuid(),estado:z.enum(["declarada","revogada"]),revisao:z.number().int().positive(),atualizado_em:z.string().datetime({offset:true})}).strict();
export function InterrupcoesParcela({userId,clienteId,parcelaId}:{userId:string;clienteId:string;parcelaId:string}){
  const [aberto,setAberto]=useState(false);const consulta=useInfiniteQuery({queryKey:["backlog-interrupcoes",userId,clienteId,parcelaId],enabled:aberto,gcTime:0,initialPageParam:null as string | null,
    queryFn:async({pageParam,signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_listar_interrupcoes_parcela",{p_parcela_id:parcelaId,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;return z.array(schema).max(20).parse(data);},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.os_id : undefined});
  return <section><button type="button" onClick={()=>setAberto((v)=>!v)}>{aberto ? "Ocultar declarações" : "Ver declarações por OS"}</button>
    {aberto && <><p>Declaração humana não comprova atribuição nem interrupção real em campo.</p><DeclararInterrupcao userId={userId} clienteId={clienteId} parcelaId={parcelaId}/><HistoricoParcela userId={userId} clienteId={clienteId} parcelaId={parcelaId}/>{consulta.isPending && <output>Consultando declarações…</output>}{consulta.isError && <p role="alert">Não foi possível consultar declarações. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isError && consulta.data?.pages.flat().length===0 && <p>Sem declarações registradas.</p>}{!consulta.isError && <ul>{consulta.data?.pages.flat().map((i)=><li key={i.os_id}>OS {i.os_id} · {i.estado} · revisão {i.revisao} · {new Date(i.atualizado_em).toLocaleString("pt-BR")}</li>)}</ul>}
      {consulta.hasNextPage && <button type="button" disabled={consulta.isFetchingNextPage} onClick={()=>void consulta.fetchNextPage()}>Mais declarações</button>}</>}
  </section>;
}
