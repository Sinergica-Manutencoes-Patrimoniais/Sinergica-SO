import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha=z.object({decisao_id:z.string().uuid(),decisao:z.enum(["aprovado","recusado"]),decisao_em:z.string(),decisao_autor:z.string().uuid().nullable()}).strict();
type Props={usuario:string;cliente:string;orcamento:string}&({os:string;requisicao?:never}|{os?:never;requisicao:string});
export function DecisoesLegadoOs({usuario,cliente,os,requisicao,orcamento}:Props){
 const [aberto,setAberto]=useState(false);
 const q=useInfiniteQuery({queryKey:["decisoes-legado",usuario,cliente,os??null,requisicao??null,orcamento],enabled:aberto,gcTime:0,retry:false,initialPageParam:null as string|null,
  queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");
   const requisicaoRpc=os?supabase.schema("comercial").rpc("sso_decisoes_legado_os_paginadas",{p_ator_id:usuario,p_cliente_id:cliente,p_os_id:os,p_orcamento_id:orcamento,p_apos:pageParam,p_limite:20}):supabase.schema("comercial").rpc("sso_decisoes_legado_pre_os_paginadas",{p_ator_id:usuario,p_cliente_id:cliente,p_requisicao_id:requisicao,p_orcamento_id:orcamento,p_apos:pageParam,p_limite:20});
   const {data,error}=await requisicaoRpc.abortSignal(signal);
   if(error)throw error;const pagina=z.array(linha).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";
   for(const item of pagina){const id=item.decisao_id.toLowerCase();if(id<=anterior)throw new Error("Página divergente.");anterior=id;}
   const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==usuario||signal.aborted)throw new Error("Sessão alterada.");return pagina;},getNextPageParam:p=>p.length===20?p.at(-1)?.decisao_id:undefined});
 return <section aria-label="Decisões do orçamento legado"><button type="button" aria-expanded={aberto} onClick={()=>setAberto(v=>!v)}>{aberto?"Ocultar decisões":"Consultar decisões"}</button>
  {aberto&&<><p>Decisões registradas neste orçamento; a consulta não reemite ou comprova comunicação externa.</p>{q.isFetching&&<output>Consultando decisões…</output>}{q.isError&&<p role="alert">Decisões indisponíveis. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
   {!q.isFetching&&!q.isError&&q.data&&(q.data.pages.flat().length===0?<p>Nenhuma decisão encontrada.</p>:<ul>{q.data.pages.flat().map(d=><li key={d.decisao_id}>{d.decisao} · {d.decisao_id} · {d.decisao_autor??"autor não informado"} · {d.decisao_em}</li>)}</ul>)}
   {q.hasNextPage&&!q.isError&&<button type="button" disabled={q.isFetching} onClick={()=>void q.fetchNextPage()}>Mais decisões</button>}</>}
 </section>;
}
