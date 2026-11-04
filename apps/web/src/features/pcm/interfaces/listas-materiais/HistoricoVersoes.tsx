import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseListasMateriaisAdapter } from "../../infrastructure/supabase-listas-materiais-adapter";

const versaoSchema=z.object({revisao:z.number().int().positive(),criado_por:z.string().uuid(),criado_em:z.string().datetime({offset:true})}).strict();
export function HistoricoVersoes(props:{usuario:string;cliente:string;ordemServico:string;listaId:string;revisao:number}){
  if(import.meta.env.VITE_SSO_HISTORICO_MATERIAIS_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([props.usuario,props.cliente,props.ordemServico,props.listaId])} {...props}/>;
}
function Conteudo({usuario,cliente,ordemServico,listaId,revisao}:{usuario:string;cliente:string;ordemServico:string;listaId:string;revisao:number}){
  const [aberto,setAberto]=useState(false);const [selecionada,setSelecionada]=useState<number | null>(null);
  const versoes=useInfiniteQuery({queryKey:["listas-materiais",usuario,cliente,ordemServico,"historico",listaId,revisao],enabled:aberto,gcTime:0,initialPageParam:null as number | null,
    queryFn:async({pageParam,signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_listar_versoes_materiais",{p_lista_id:listaId,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;return z.array(versaoSchema).max(20).parse(data);},
    getNextPageParam:(pagina)=>pagina.length===20 ? pagina.at(-1)?.revisao : undefined});
  const linhas=useQuery({queryKey:["listas-materiais",usuario,cliente,ordemServico,"historico-linhas",listaId,selecionada],enabled:aberto && selecionada!==null,gcTime:0,
    queryFn:({signal})=>supabaseListasMateriaisAdapter.obterLinhasExatas(listaId,selecionada ?? 2,signal)});
  return <section aria-label="Histórico de versões de materiais"><button type="button" onClick={()=>setAberto((v)=>!v)}>{aberto ? "Ocultar versões" : "Ver versões das linhas"}</button>
    {aberto && <><p>As revisões abaixo registram organização de linhas; outras alterações da lista podem ter números intermediários.</p>
      {versoes.isPending && <output>Carregando versões…</output>}{versoes.isError && <p role="alert">Não foi possível consultar versões. <button type="button" onClick={()=>void versoes.refetch()}>Tentar novamente</button></p>}
      {!versoes.isError && versoes.data?.pages.flat().length===0 && <p>Nenhuma versão de linhas registrada.</p>}
      {!versoes.isError && versoes.data?.pages.flat().map((v)=><button key={v.revisao} type="button" onClick={()=>setSelecionada(v.revisao)}>Revisão {v.revisao} · {new Date(v.criado_em).toLocaleString("pt-BR")} · responsável {v.criado_por}</button>)}
      {versoes.hasNextPage && <button type="button" disabled={versoes.isFetchingNextPage} onClick={()=>void versoes.fetchNextPage()}>Mais versões</button>}
      {selecionada!==null && linhas.isPending && <output>Carregando linhas da versão…</output>}
      {selecionada!==null && linhas.isError && <p role="alert">Não foi possível consultar linhas da versão. <button type="button" onClick={()=>void linhas.refetch()}>Tentar novamente</button></p>}
      {selecionada!==null && !linhas.isFetching && !linhas.isError && linhas.data && <ol>{linhas.data.map((l,i)=><li key={`${selecionada}:${i}`}>{l.descricao} · {l.quantidade ?? "quantidade não informada"} · {l.unidade ?? "unidade não informada"}<p>Fonte: {l.trechosOriginais.join(" / ")}</p></li>)}</ol>}
    </>}
  </section>;
}
