import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { OcorrenciasImpactoDia } from "./OcorrenciasImpactoDia";

const data=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const linha=z.object({visita_id:z.string().guid(),semana_origem:data,regra_origem_id:z.string().guid(),inicio_em:z.string().datetime({offset:true}),
  estado:z.string().min(1),revisao:z.number().int().positive(),data_proposta:data,
  classificacao:z.enum(["data_proposta_antes_vigencia","candidata_revisao","preservar_e_conferir"]),
  feriado_declarado:z.boolean().optional(),ocorrencia_preparada:z.boolean().optional()}).strict();
type Cursor={semana:string;id:string}|null;
export function PreviaMudancaDia({userId,clienteId,serieId,revisao,vigencia,dia}:{userId:string;clienteId:string;serieId:string;revisao:number;vigencia:string;dia:number}){
  const [visitaSelecionada,setVisitaSelecionada]=useState<string|null>(null);
  const consulta=useInfiniteQuery({queryKey:["calendario-previa-mudanca-dia",userId,clienteId,serieId,revisao,vigencia,dia],gcTime:0,retry:false,initialPageParam:null as Cursor,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data:resposta,error}=await supabase.schema("pcm").rpc(import.meta.env.VITE_SSO_PREVIA_IMPEDIMENTOS_DIA_ENABLED === "true" ? "sso_prever_impedimentos_mudanca_dia" : "sso_prever_mudanca_dia",{p_ator_id:userId,p_cliente_id:clienteId,p_serie_id:serieId,p_expected_revision:revisao,
        p_vigencia:vigencia,p_dia_semana:dia,p_apos_semana:pageParam?.semana??null,p_apos_id:pageParam?.id??null,p_limite:30}).abortSignal(signal);
      if(error)throw error;const pagina=z.array(linha).max(30).parse(resposta);let anterior=pageParam;
      for(const item of pagina){const id=item.visita_id.toLowerCase();if(anterior&&(item.semana_origem<anterior.semana||(item.semana_origem===anterior.semana&&id<=anterior.id.toLowerCase())))throw new Error("Página divergente.");anterior={semana:item.semana_origem,id};}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(p)=>{const item=p.at(-1);return p.length===30&&item?{semana:item.semana_origem,id:item.visita_id}:undefined;}});
  return <section aria-label="Impacto da mudança de dia"><h4>Visitas vinculadas para conferência</h4>
    <p>Prévia por semana de origem. Datas são sugestões civis; nada é reprogramado. Feriados e ocorrências são indicados somente quando a consulta correspondente estiver ativa; páginas não formam fotografia única. Visitas sem origem comprovada e extras não estão incluídas.</p>
    {consulta.isFetching&&<output>Consultando impacto…</output>}{consulta.isError&&<p role="alert">Impacto indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching&&!consulta.isError&&consulta.data&&<>{consulta.data.pages.flat().length===0?<p>Nenhuma Visita vinculada encontrada nesta consulta; isso não prova ausência de Visitas legadas.</p>:<ul>{consulta.data.pages.flat().map((v)=><li key={v.visita_id}>Visita {v.visita_id} · semana {v.semana_origem} · início {v.inicio_em} · estado {v.estado} · revisão {v.revisao} · data proposta {v.data_proposta} · {v.classificacao === "candidata_revisao" ? "candidata a revisão" : v.classificacao === "data_proposta_antes_vigencia" ? "data proposta anterior à vigência" : "preservar e conferir"}.
      {v.feriado_declarado&&<strong> Feriado declarado na data proposta; mudança exige tratamento.</strong>}
      {v.ocorrencia_preparada&&<strong> Há ocorrência preparada; mudança exige reconciliação.</strong>}
      {import.meta.env.VITE_SSO_IMPACTO_OCORRENCIAS_DIA_ENABLED === "true"&&<button type="button" onClick={()=>setVisitaSelecionada((atual)=>atual===v.visita_id?null:v.visita_id)}>{visitaSelecionada===v.visita_id?"Ocultar ocorrências":"Conferir ocorrências"}</button>}
      {import.meta.env.VITE_SSO_IMPACTO_OCORRENCIAS_DIA_ENABLED === "true"&&visitaSelecionada===v.visita_id&&<OcorrenciasImpactoDia userId={userId} clienteId={clienteId} serieId={serieId} visitaId={v.visita_id} />}</li>)}</ul>}{consulta.hasNextPage&&<button type="button" onClick={()=>void consulta.fetchNextPage()}>Mais Visitas</button>}</>}
  </section>;
}
