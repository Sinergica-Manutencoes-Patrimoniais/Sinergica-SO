import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ ocorrencia_id:z.string().uuid(),plano_id:z.string().uuid(),rotina_id:z.string().uuid(),visita_id:z.string().uuid(),vencimento_original:z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
type Props={userId:string;clienteId:string;feriadoId:string;data:string};
export function ImpactosFeriado(props:Props){
  const [aberto,setAberto]=useState(false);
  if(import.meta.env.VITE_SSO_IMPACTOS_FERIADO_VISITA_ENABLED!=="true")return null;
  return <><button type="button" aria-expanded={aberto} onClick={()=>setAberto(v=>!v)}>{aberto?"Ocultar ocorrências":"Consultar ocorrências afetadas"}</button>{aberto&&<Conteudo key={JSON.stringify([props.userId,props.clienteId,props.feriadoId,props.data])} {...props}/>}</>;
}
function Conteudo({userId,clienteId,feriadoId,data}:Props){
  const q=useInfiniteQuery({queryKey:["impactos-feriado-visita",userId,clienteId,feriadoId,data],gcTime:0,initialPageParam:null as string|null,queryFn:async({pageParam,signal})=>{
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
    const {data:resposta,error}=await supabase.schema("pcm").rpc("sso_listar_impactos_feriado_visita",{p_ator_id:userId,p_cliente_id:clienteId,p_feriado_id:feriadoId,p_apos:pageParam,p_limite:30}).abortSignal(signal);
    if(error)throw error;const pagina=z.array(linha).max(30).parse(resposta);let anterior=pageParam?.toLowerCase()??null;
    for(const item of pagina){const id=item.ocorrencia_id.toLowerCase();if((anterior!==null&&id<=anterior)||item.vencimento_original!==data)throw new Error("Página inconsistente.");anterior=id;}
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;
  },getNextPageParam:p=>p.length===30 ? p[p.length-1]?.ocorrencia_id : undefined});
  return <section aria-label="Possíveis impactos do feriado"><p>Coincidências de ocorrências preparadas por Visita. Não confirmam execução e não incluem todos os fluxos ou dados legados.</p>
    {q.isFetching&&<output>Consultando ocorrências…</output>}{q.isError&&<p role="alert">Consulta indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching&&!q.isError&&q.data&&<>{q.data.pages.flat().length===0 ? <p>Nenhuma ocorrência encontrada nesta fonte.</p> : <ul>{q.data.pages.flat().map(o=><li key={o.ocorrencia_id}>Ocorrência {o.ocorrencia_id} · Plano {o.plano_id} · Rotina {o.rotina_id} · Visita {o.visita_id} · {o.vencimento_original}</li>)}</ul>}{q.hasNextPage&&<button type="button" onClick={()=>void q.fetchNextPage()}>Mais ocorrências</button>}</>}
  </section>;
}
