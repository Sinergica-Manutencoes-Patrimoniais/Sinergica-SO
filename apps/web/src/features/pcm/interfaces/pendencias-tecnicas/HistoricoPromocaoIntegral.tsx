import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id=z.string().guid();
const recibo=z.object({requestId:id,clienteId:id,retornoId:id,retornoRevision:z.number().int().positive(),pendenciaId:id,
 chamadoAnteriorId:id,parcelaAnteriorId:id,cicloAnteriorId:id,chamadoId:id,numero:z.string().min(1),parcelaId:id,cicloId:id,
 osCriada:z.literal(false),tarefaCriada:z.literal(false)}).strict();
export function HistoricoPromocaoIntegral({userId,clienteId,retornoId}:{userId:string;clienteId:string;retornoId:string}){
 const [aberto,setAberto]=useState(false);
 const consulta=useQuery({queryKey:["backlog-promocao-integral-historico",userId,clienteId,retornoId],enabled:aberto,gcTime:0,retry:false,
  queryFn:async({signal})=>{const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");
   const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_promocao_retorno_integral",{p_ator_id:userId,p_cliente_id:clienteId,p_retorno_id:retornoId}).abortSignal(signal);if(error)throw error;
   const r=data===null?null:recibo.parse(data);if(r && (r.clienteId!==clienteId || r.retornoId!==retornoId))throw new Error("Recibo divergente.");
   const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");return r;}});
 return <section aria-label="Histórico da promoção integral"><button type="button" aria-expanded={aberto} onClick={()=>setAberto(!aberto)}>{aberto?"Ocultar histórico da promoção":"Consultar histórico da promoção"}</button>
  {aberto && consulta.isFetching && <p role="status">Consultando histórico…</p>}{aberto && consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
  {aberto && !consulta.isFetching && !consulta.isError && consulta.data===null && <p>Nenhum recibo encontrado nesta consulta.</p>}
  {aberto && !consulta.isFetching && !consulta.isError && consulta.data && <div><p>Chamado anterior {consulta.data.chamadoAnteriorId} · parcela {consulta.data.parcelaAnteriorId} · ciclo {consulta.data.cicloAnteriorId}.</p>
   <p>Chamado {consulta.data.numero} ({consulta.data.chamadoId}) · parcela {consulta.data.parcelaId} · ciclo {consulta.data.cicloId}.</p>
   <p>O recibo não comprova execução ou parada remota; esta promoção não criou OS ou tarefa.</p></div>}
 </section>;
}
