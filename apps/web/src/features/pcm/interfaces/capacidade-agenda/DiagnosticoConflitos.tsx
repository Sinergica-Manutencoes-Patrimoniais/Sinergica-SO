import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";

type Resultado={disponibilidadeId:string;revisao:number;intervalos:{visita_id:string;intervalo_id:string;tipo:string}[];
  visitas:{visita_a:string;visita_b:string}[];truncado:boolean;abrangencia:string;provaDisponibilidade:boolean};
export function DiagnosticoConflitos({userId,clienteId,disponibilidadeId,revision}:{userId:string;clienteId:string;disponibilidadeId:string;revision:number}) {
  const consulta=useQuery({queryKey:["capacidade-conflitos",userId,clienteId,disponibilidadeId,revision],gcTime:0,refetchOnWindowFocus:true,
    queryFn:async({signal}) => {const {data,error}=await supabase.schema("pcm").rpc("sso_diagnosticar_conflitos_capacidade",{p_disponibilidade_id:disponibilidadeId}).abortSignal(signal);
      if(error)throw error;if(!data||data.disponibilidadeId!==disponibilidadeId||data.revisao!==revision||!Array.isArray(data.intervalos)||!Array.isArray(data.visitas)||
        typeof data.truncado!=="boolean"||data.abrangencia!=="parcial_mesmo_cliente"||data.provaDisponibilidade!==false)throw new Error("Diagnóstico inválido.");return data as Resultado;}});
  return <section aria-label="Conflitos parciais de agenda"><h4>Conflitos parciais</h4>
    <p>Somente Visitas e intervalos declarados deste Cliente. Sem dados de outros Clientes, RH e especialidades, ausência de conflito não prova disponibilidade. Não bloqueia planejamento.</p>
    {consulta.isFetching&&<output>Conferindo conflitos…</output>}{consulta.isError&&<p role="alert">Conferência indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data&&!consulta.isFetching&&!consulta.isError&&<><ul>{consulta.data.intervalos.map((c) => <li key={`${c.visita_id}:${c.intervalo_id}`}>Visita {c.visita_id} sobrepõe {c.tipo} declarada {c.intervalo_id}</li>)}
      {consulta.data.visitas.map((c) => <li key={`${c.visita_a}:${c.visita_b}`}>Visitas {c.visita_a} e {c.visita_b} sobrepostas para o técnico</li>)}</ul>
      {consulta.data.intervalos.length===0&&consulta.data.visitas.length===0&&<p>Nenhuma sobreposição encontrada nas fontes parciais.</p>}
      {consulta.data.truncado&&<p role="alert">Resultado limitado a 100 conflitos de cada tipo; há outros não exibidos.</p>}</>}
  </section>;
}
