import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const semanaSchema=z.object({semana_inicio:z.string(),declaracoes:z.number().int().nonnegative().safe(),visitas:z.number().int().nonnegative().safe(),
  disponibilidade_completa:z.literal(false),demanda_completa:z.literal(false),disponibilidade_minutos:z.null(),demanda_minutos:z.null(),saldo_minutos:z.null()}).strict();
export function HorizonteCapacidade({userId,clienteId,semana}:{userId:string;clienteId:string;semana:string}) {
  const [quantidade,setQuantidade]=useState("4");const [solicitado,setSolicitado]=useState(4);
  const [gruposAbertos,setGruposAbertos]=useState(false);
  const mediado=import.meta.env.VITE_SSO_HORIZONTE_CAPACIDADE_MEDIADO_ENABLED==="true";
  const consulta=useQuery({queryKey:["capacidade-horizonte",userId,clienteId,semana,solicitado,mediado],gcTime:0,refetchOnWindowFocus:true,
    queryFn:async({signal}) => {
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const inicio=new Date(`${semana}T00:00:00.000Z`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(semana)||semana.startsWith("0000")||!Number.isFinite(inicio.getTime())||inicio.toISOString().slice(0,10)!==semana||inicio.getUTCDay()!==1)throw new Error("Semana inválida.");
      const parametros={p_cliente_id:clienteId,p_semana_inicio:semana,p_quantidade:solicitado};
      const {data,error}=await (mediado
        ? supabase.schema("pcm").rpc("sso_horizonte_capacidade_mediado",{...parametros,p_ator_id:userId})
        : supabase.schema("pcm").rpc("sso_horizonte_capacidade_preparado",parametros)).abortSignal(signal);
      if(error)throw error;
      const paginas=z.array(semanaSchema).length(solicitado).parse(data);
      for(let i=0;i<paginas.length;i++){
        const esperado=new Date(inicio.getTime()+i*7*86_400_000).toISOString().slice(0,10);
        if(paginas[i]?.semana_inicio!==esperado)throw new Error("Horizonte divergente.");
      }
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return paginas;}});
  return <section aria-label="Horizonte parcial de capacidade"><h3>Horizonte parcial de capacidade</h3>
    <p>As fontes de disponibilidade e demanda ainda não estão comprovadas. Não há saldo calculado nem garantia de equipe viável.</p>
    <form onSubmit={(e) => {e.preventDefault();const n=Number(quantidade);if(Number.isInteger(n)&&n>=1&&n<=12)setSolicitado(n);}}>
      <label>Semanas <input required type="number" min="1" max="12" value={quantidade} onChange={(e) => setQuantidade(e.target.value)}/></label><button type="submit">Consultar horizonte</button></form>
    {consulta.isFetching&&<output>Carregando horizonte…</output>}{consulta.isError&&<p role="alert">Horizonte indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data&&!consulta.isFetching&&!consulta.isError&&<ul>{consulta.data.map((s) => <li key={s.semana_inicio}>Semana {s.semana_inicio} · {s.declaracoes} declarações · {s.visitas} Visitas · disponibilidade {s.disponibilidade_completa?"completa":"incompleta"} · demanda {s.demanda_completa?"completa":"incompleta"} · saldo não calculado</li>)}</ul>}
    {import.meta.env.VITE_SSO_HORIZONTE_GRUPO_MEDIADO_ENABLED==="true" && <><button type="button" aria-expanded={gruposAbertos} onClick={()=>setGruposAbertos(v=>!v)}>{gruposAbertos?"Ocultar estimativas de Grupos":"Consultar estimativas de Grupos"}</button>
      {gruposAbertos && <HorizonteGrupos key={JSON.stringify([userId,clienteId,semana,solicitado])} userId={userId} clienteId={clienteId} semana={semana} quantidade={solicitado}/>}</>}
  </section>;
}

const grupoSchema=z.object({semana_inicio:z.string(),visitas:z.number().int().nonnegative().safe(),declaracoes:z.number().int().nonnegative().safe(),
  grupos_lidos:z.number().int().min(0).max(10000),grupos_sem_tempo:z.number().int().nonnegative(),grupos_com_sobreposicao:z.number().int().nonnegative(),
  subtotal_grupo_sem_os_minutos:z.string().regex(/^[0-9]+$/).max(100),fonte_truncada:z.boolean(),
  demanda_completa:z.literal(false),disponibilidade_completa:z.literal(false),saldo_minutos:z.null()}).strict();
function HorizonteGrupos({userId,clienteId,semana,quantidade}:{userId:string;clienteId:string;semana:string;quantidade:number}) {
  const q=useQuery({queryKey:["capacidade-horizonte-grupos",userId,clienteId,semana,quantidade],gcTime:0,retry:false,
    queryFn:async({signal})=>{
      const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const inicio=new Date(`${semana}T00:00:00.000Z`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(semana)||semana.startsWith("0000")||!Number.isFinite(inicio.getTime())||inicio.toISOString().slice(0,10)!==semana||inicio.getUTCDay()!==1)throw new Error("Semana inválida.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_horizonte_capacidade_grupo_mediado",{p_ator_id:userId,p_cliente_id:clienteId,p_semana_inicio:semana,p_quantidade:quantidade}).abortSignal(signal);
      if(error)throw error;
      const linhas=z.array(grupoSchema).length(quantidade).parse(data);
      for(let i=0;i<linhas.length;i++){const l=linhas[i]!;const esperado=new Date(inicio.getTime()+i*7*86_400_000).toISOString().slice(0,10);
        if(l.semana_inicio!==esperado||l.grupos_sem_tempo+l.grupos_com_sobreposicao>l.grupos_lidos)throw new Error("Horizonte divergente.");}
      const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      return linhas;}});
  return <section aria-label="Estimativas parciais de Grupos"><h4>Estimativas parciais de Grupos</h4>
    <p>Somente fontes de Grupo sem estimativa de OS sobreposta. Não inclui toda demanda, não prova esforço restante e não representa saldo.</p>
    {q.isFetching&&<output>Consultando Grupos…</output>}{q.isError&&<p role="alert">Estimativas de Grupos indisponíveis. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching&&!q.isError&&q.data&&<ul>{q.data.map(l=><li key={l.semana_inicio}>Semana {l.semana_inicio} · subtotal declarado {l.subtotal_grupo_sem_os_minutos} min · {l.grupos_lidos} fontes lidas · {l.grupos_sem_tempo} sem tempo · {l.grupos_com_sobreposicao} com estimativa de OS excluídas do subtotal{l.fonte_truncada?" · limite atingido, fonte truncada":""}</li>)}</ul>}
  </section>;
}
