import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { RelatorioPrevia } from "./RelatorioPrevia";
import { ConferenciaPlanoLegado } from "./ConferenciaPlanoLegado";

const linha=z.object({plano_legado_id:z.string().guid(),plano_destino_id:z.string().guid().nullable(),rotina_id:z.string().guid().nullable(),versao_id:z.string().guid().nullable(),estado_destino:z.string().nullable(),
  classificacao:z.enum(["alvo_ambiguo","alvo_indisponivel","destino_ocupado","mapeamento_inconsistente","origem_alterada","rascunho_registrado","destino_sem_mapeamento","sem_destino_observado"])}).strict();
const nomes={alvo_ambiguo:"Alvo ambíguo: revisar",alvo_indisponivel:"Alvo indisponível: revisar",destino_ocupado:"Identidade de destino indisponível: revisar",mapeamento_inconsistente:"Mapeamento inconsistente: revisar",origem_alterada:"Origem alterada após rascunho",rascunho_registrado:"Rascunho registrado",destino_sem_mapeamento:"Destino sem mapeamento conhecido",sem_destino_observado:"Sem destino observado"} as const;

export function MapaPlanosLegados({userId,clienteId}:{userId:string;clienteId:string}){
 if(import.meta.env.VITE_SSO_MAPA_PLANOS_LEGADOS_ENABLED!=="true")return null;
 return <Conteudo key={JSON.stringify([userId,clienteId])} userId={userId} clienteId={clienteId}/>;
}
function Conteudo({userId,clienteId}:{userId:string;clienteId:string}){
 const consulta=useInfiniteQuery({queryKey:["migracao-mapeamento-planos",userId,clienteId],gcTime:0,retry:false,initialPageParam:null as string|null,
  queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
   const {data,error}=await supabase.schema("pcm").rpc("sso_prever_mapeamento_planos",{p_ator_id:userId,p_cliente_id:clienteId,p_apos:pageParam,p_limite:50}).abortSignal(signal);if(error)throw error;
   const pagina=z.array(linha).max(50).parse(data);let anterior=pageParam?.toLowerCase()??"";for(const item of pagina){const id=item.plano_legado_id.toLowerCase();if(id<=anterior)throw new Error("Página divergente.");anterior=id;}
   const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;},
  getNextPageParam:(pagina)=>pagina.length===50?pagina.at(-1)?.plano_legado_id:undefined});
 const linhas=consulta.data?.pages.flat()??[];const divergentes=linhas.some((item,i)=>i>0&&item.plano_legado_id.toLowerCase()<=linhas[i-1]!.plano_legado_id.toLowerCase());
 const totais=new Map<string,number>();for(const item of linhas)totais.set(item.classificacao,(totais.get(item.classificacao)??0)+1);
 return <section aria-label="Mapeamento de Planos legados"><h3>Mapeamento observado de Planos</h3>
  <p>Somente páginas carregadas. Não comprova equivalência, ausência de duplicidade, histórico completo ou aceite; nenhuma alteração é feita.</p>
  {consulta.isFetching&&<output>Consultando mapeamento…</output>}
  {consulta.isError&&<p role="alert">Mapeamento indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
  {!consulta.isFetching&&!consulta.isError&&divergentes&&<p role="alert">Páginas divergentes. <button type="button" onClick={()=>void consulta.refetch()}>Reconsultar</button></p>}
  {!consulta.isFetching&&!consulta.isError&&!divergentes&&consulta.data&&<>
   {linhas.length===0?<p>Nenhum Plano legado nesta consulta.</p>:<><ul>{[...totais.entries()].map(([nome,total])=><li key={nome}>{nomes[nome as keyof typeof nomes]}: {total}</li>)}</ul>
    <ul>{linhas.map(item=><li key={item.plano_legado_id}>Plano legado {item.plano_legado_id} · {nomes[item.classificacao]} · destino {item.plano_destino_id??"não observado"} · estado {item.estado_destino??"não informado"} · versão {item.versao_id??"não registrada"} · Rotina {item.rotina_id??"não registrada"}{import.meta.env.VITE_SSO_CONFERENCIA_PLANO_LEGADO_ENABLED === "true" && <ConferenciaPlanoLegado userId={userId} clienteId={clienteId} planoId={item.plano_legado_id}/>}</li>)}</ul></>}
   {linhas.length>0&&<RelatorioPrevia userId={userId} clienteId={clienteId} tipo="mapeamento-planos" registros={linhas.map(item=>({id:item.plano_legado_id,classificacao:item.classificacao,dados:{planoDestinoId:item.plano_destino_id,estadoDestino:item.estado_destino,versaoId:item.versao_id,rotinaId:item.rotina_id}}))} parcial={!!consulta.hasNextPage} disponivel={!consulta.isFetching&&!consulta.isError&&!divergentes}/>}
   {consulta.hasNextPage&&<><p>Há outras páginas; contagens incompletas.</p><button type="button" onClick={()=>void consulta.fetchNextPage()}>Mais Planos</button></>}
  </>}
 </section>;
}
