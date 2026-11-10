import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";

export function ConflitosInterclientes({userId,clienteId,disponibilidadeId,revision}:{userId:string;clienteId:string;disponibilidadeId:string;revision:number}) {
  const consulta=useQuery({queryKey:["capacidade-conflitos-global",userId,clienteId,disponibilidadeId,revision],gcTime:0,refetchOnWindowFocus:true,
    queryFn:async({signal}) => {const {data,error}=await supabase.schema("pcm").rpc("sso_diagnosticar_conflitos_interclientes",{p_disponibilidade_id:disponibilidadeId}).abortSignal(signal);
      if(error)throw error;if(!data||data.disponibilidadeId!==disponibilidadeId||data.revisao!==revision||!Number.isSafeInteger(data.registrosExternosComConflito)||data.provaDisponibilidade!==false)throw new Error("Diagnóstico inválido.");return data.registrosExternosComConflito as number;}});
  return <section aria-label="Conflitos agregados entre Clientes"><h4>Conflitos agregados entre Clientes</h4>
    <p>Consulta restrita a concessão global. Não mostra Cliente, horário ou motivo; resultado parcial não prova disponibilidade.</p>
    {consulta.isFetching&&<output>Conferindo conflitos agregados…</output>}{consulta.isError&&<p role="alert">Consulta indisponível ou sem concessão global. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data!==undefined&&!consulta.isFetching&&!consulta.isError&&<p>{consulta.data} registro(s) externo(s) com sobreposição nas fontes existentes.</p>}
  </section>;
}
