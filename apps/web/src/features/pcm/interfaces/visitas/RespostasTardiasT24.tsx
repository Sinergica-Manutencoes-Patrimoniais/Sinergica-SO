import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha=z.object({request_id:z.string().uuid(),fence:z.number().int().safe().positive(),tarefa_observada:z.string().min(1).max(200).nullable(),motivo:z.string().regex(/^[a-z0-9_]{1,120}$/),criado_em:z.string().datetime({offset:true})}).strict();
type Props={userId:string;clienteId:string;visitaId:string;osId:string;tentativaId:string};
export function RespostasTardiasT24(props:Props){return <Conteudo key={JSON.stringify(Object.values(props))} {...props}/>;}
function Conteudo({userId,clienteId,visitaId,osId,tentativaId}:Props){
 const q=useInfiniteQuery({queryKey:["t24-respostas-tardias",userId,clienteId,visitaId,osId,tentativaId],gcTime:0,retry:false,initialPageParam:null as string|null,
  queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
   const {data,error}=await supabase.schema("pcm").rpc("sso_t24_listar_respostas_tardias",{p_cliente_id:clienteId,p_visita_id:visitaId,p_os_id:osId,p_tentativa_id:tentativaId,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;
   const pagina=z.array(linha).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";for(const item of pagina){if(item.request_id.toLowerCase()<=anterior)throw new Error("Página divergente.");anterior=item.request_id.toLowerCase();}
   const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
  getNextPageParam:p=>p.length===20?p.at(-1)?.request_id:undefined});
 const itens=q.data?.pages.flat()??[];let anterior="";let divergente=false;
 for(const item of itens){const id=item.request_id.toLowerCase();if(id<=anterior){divergente=true;break;}anterior=id;}
 return <section aria-label="Respostas tardias"><h5>Respostas tardias</h5><p>Observações não confirmam vínculo ou estado remoto; exigem reconciliação.</p>
  {q.isFetching&&<output>Consultando respostas…</output>}{q.isError&&<p role="alert">Respostas indisponíveis ou sem permissão. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
  {!q.isFetching&&!q.isError&&divergente&&<p role="alert">Páginas divergentes. Atualize a consulta.</p>}
  {!q.isFetching&&!q.isError&&!divergente&&q.data&&(itens.length===0?<p>Nenhuma observação registrada nesta consulta.</p>:<ul>{itens.map(r=><li key={r.request_id}>Versão {r.fence} · tarefa observada {r.tarefa_observada??"não informada"} · {r.motivo.replaceAll("_"," ")} · {new Date(r.criado_em).toLocaleString("pt-BR")}</li>)}</ul>)}
  {q.hasNextPage&&!q.isError&&!divergente&&<button type="button" disabled={q.isFetching} onClick={()=>void q.fetchNextPage()}>Mais respostas</button>}
  <button type="button" disabled={q.isFetching} onClick={()=>void q.refetch()}>Atualizar respostas</button>
 </section>;
}
