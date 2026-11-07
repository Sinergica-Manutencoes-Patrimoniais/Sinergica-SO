import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha=z.object({revisao:z.number().int().positive(),participacao_id:z.string().guid().nullable(),tecnico_nome:z.string().nullable(),
  vinculo:z.enum(["sem_atribuicao","ausente","incompativel","vigente","encerrado"]),motivo:z.string().min(1).max(2000),ator_id:z.string().guid(),criado_em:z.string()}).strict();
export function HistoricoTecnicoDespesa({userId,clienteId,visitaId,despesaId,revisao}:{userId:string;clienteId:string;visitaId:string;despesaId:string;revisao:number}){
  const [aberto,setAberto]=useState(false);
  const consulta=useInfiniteQuery({queryKey:["despesas-visita",userId,clienteId,visitaId,despesaId,"historico-tecnico",revisao],enabled:aberto,gcTime:0,retry:false,initialPageParam:0,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_historico_tecnico_despesa",{p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId,p_despesa_id:despesaId,p_apos:pageParam,p_limite:30}).abortSignal(signal);
      if(error)throw error;const pagina=z.array(linha).max(30).parse(data);let anterior=pageParam;
      for(const item of pagina){if(item.revisao<=anterior||(["sem_atribuicao","ausente","incompativel"].includes(item.vinculo)&&item.participacao_id!==null))throw new Error("Histórico divergente.");anterior=item.revisao;}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina)=>pagina.length===30?pagina.at(-1)?.revisao:undefined});
  return <section aria-label="Histórico de técnico da despesa"><button type="button" aria-expanded={aberto} onClick={()=>setAberto(v=>!v)}>{aberto?"Ocultar histórico de técnico":"Ver histórico de técnico"}</button>
    {aberto&&<><p>O estado do vínculo é o atual; atribuição não comprova execução ou pagamento.</p>
      {consulta.isFetching&&<output>Consultando histórico…</output>}{consulta.isError&&<p role="alert">Histórico indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching&&!consulta.isError&&consulta.data&&<>{consulta.data.pages.flat().length===0?<p>Nenhuma atribuição registrada.</p>:<ul>{consulta.data.pages.flat().map(item=><li key={item.revisao}>Revisão {item.revisao} · {item.tecnico_nome??"sem técnico identificável"} · vínculo {item.vinculo} · {item.motivo} · autor {item.ator_id} · {item.criado_em}</li>)}</ul>}</>}
      {consulta.hasNextPage&&!consulta.isError&&<button type="button" disabled={consulta.isFetching} onClick={()=>void consulta.fetchNextPage()}>Mais registros</button>}
    </>}
  </section>;
}
