import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const alerta=z.enum(["capacidade_nao_verificada","sobrecarga","simultaneidade_incompativel","qualificacao_incompativel","conflito","equipe_nao_verificada"]);
const linha=z.object({request_id:z.string().uuid(),ator_id:z.string().uuid(),vencimento_declarado:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  alertas:z.array(alerta).max(6),motivo:z.string().min(1).max(2000),criado_em:z.string().datetime({offset:true}),
  origem_parcial:z.boolean().nullable().optional(),destino_parcial:z.boolean().nullable().optional()}).strict();
const rotulos:Record<z.infer<typeof alerta>,string>={capacidade_nao_verificada:"capacidade não verificada",sobrecarga:"sobrecarga",simultaneidade_incompativel:"simultaneidade incompatível",qualificacao_incompativel:"qualificação incompatível",conflito:"conflito",equipe_nao_verificada:"equipe não verificada"};
type Props={userId:string;clienteId:string;visitaId:string};
export function HistoricoAlertasReprogramacao(props:Props){
  const [aberto,setAberto]=useState(false);if(import.meta.env.VITE_SSO_HISTORICO_ALERTAS_REPROGRAMACAO_ENABLED!=="true")return null;
  return <section><button type="button" aria-expanded={aberto} onClick={()=>setAberto((v)=>!v)}>{aberto?"Ocultar histórico de alertas":"Consultar histórico de alertas"}</button>
    {aberto&&<Lista key={JSON.stringify([props.userId,props.clienteId,props.visitaId])} {...props}/>}</section>;
}
function Lista({userId,clienteId,visitaId}:Props){
  const q=useInfiniteQuery({queryKey:["historico-alertas-reprogramacao",userId,clienteId,visitaId],gcTime:0,initialPageParam:null as string|null,queryFn:async({pageParam,signal})=>{
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("pcm").rpc(import.meta.env.VITE_SSO_HISTORICO_PROVENIENCIA_SIMULACAO_ENABLED === "true" ? "sso_listar_alertas_reprogramacao_v2" : "sso_listar_alertas_reprogramacao",{p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId,p_apos:pageParam,p_limite:30}).abortSignal(signal);
    if(error)throw error;const pagina=z.array(linha).max(30).parse(data);let anterior=pageParam?.toLowerCase()??null;
    for(const item of pagina){const id=item.request_id.toLowerCase();if((anterior!==null&&id<=anterior)||new Set(item.alertas).size!==item.alertas.length)throw new Error("Página inconsistente.");anterior=id;}
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;
  },getNextPageParam:(pagina)=>pagina.length===30?pagina[pagina.length-1]?.request_id:undefined});
  return <section aria-label="Histórico de alertas declarados"><p>Dados informados manualmente; não comprovam capacidade ou vencimento. Ordenação por identificador, não por data. Outras transições podem não constar aqui.</p>
    {q.isFetching&&<output>Consultando alertas…</output>}{q.isError&&<p role="alert">Histórico indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching&&!q.isError&&q.data&&<>{q.data.pages.flat().length===0?<p>Nenhuma declaração nesta fonte.</p>:<ul>{q.data.pages.flat().map((item)=><li key={item.request_id}>{item.criado_em} · responsável {item.ator_id} · vencimento declarado {item.vencimento_declarado} · alertas {item.alertas.length?item.alertas.map((a)=>rotulos[a]).join(", "):"nenhum informado"} · justificativa {item.motivo}{item.origem_parcial != null && item.destino_parcial != null && <span> · subtotais parciais declarados: origem {item.origem_parcial?"sim":"não"}, destino {item.destino_parcial?"sim":"não"}; fonte não comprovada</span>}</li>)}</ul>}{q.hasNextPage&&<button type="button" onClick={()=>void q.fetchNextPage()}>Mais registros</button>}</>}
  </section>;
}
