import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Props={userId:string;clienteId:string;loteId:string;chave:string;revisao:number};
export function HistoricoAtributos({userId,clienteId,loteId,chave,revisao}:Props){
  const ativo=import.meta.env.VITE_SSO_HISTORICO_ATRIBUTOS_STAGING_ENABLED==="true";
  const q=useInfiniteQuery({queryKey:["levantamentos",userId,clienteId,loteId,chave,"historico-atributos",revisao],enabled:ativo,gcTime:0,initialPageParam:null as number|null,queryFn:async({pageParam,signal})=>{
    const {data,error}=await supabase.schema("pcm").rpc("sso_historico_edicao_linha_autorizado",{p_lote_id:loteId,p_chave:chave,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;
    return z.array(z.object({revisao:z.number().int().positive(),antes:z.record(z.string(), z.unknown()),depois:z.record(z.string(), z.unknown()),motivo:z.string(),ator_id:z.string().uuid(),criado_em:z.string().datetime({offset:true})}).strict()).max(20).parse(data);
  },getNextPageParam:p=>p.length===20 ? p[p.length - 1]?.revisao : undefined});
  if(!ativo)return null;
  return <section aria-label="Histórico completo da linha"><h5>Histórico completo da linha</h5>{q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
    {q.data && <><ol>{q.data.pages.flat().map(e=><li key={e.revisao}>Revisão {e.revisao} · {e.motivo} · responsável {e.ator_id} · <time dateTime={e.criado_em}>{new Date(e.criado_em).toLocaleString("pt-BR")}</time><details><summary>Valores antes e depois</summary><dl>{[...new Set([...Object.keys(e.antes),...Object.keys(e.depois)])].sort().filter(k=>JSON.stringify(e.antes[k])!==JSON.stringify(e.depois[k])).map(k=><div key={k}><dt>{k}</dt><dd>Antes: {Object.prototype.hasOwnProperty.call(e.antes,k) ? JSON.stringify(e.antes[k]) : "não fornecido"} · Depois: {Object.prototype.hasOwnProperty.call(e.depois,k) ? JSON.stringify(e.depois[k]) : "não fornecido"}</dd></div>)}</dl></details></li>)}</ol>{q.data.pages.flat().length===0 && <p>Nenhuma edição registrada.</p>}</>}
    {q.hasNextPage && <button type="button" disabled={q.isFetching} onClick={()=>void q.fetchNextPage()}>Mais edições</button>}
  </section>;
}
