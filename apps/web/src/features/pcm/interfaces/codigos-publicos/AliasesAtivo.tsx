import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props={userId:string;clienteId:string;tipo:"sistema"|"componente";ativoId:string};
export function AliasesAtivo(props:Props){if(import.meta.env.VITE_SSO_LISTAGEM_ALIASES_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.tipo,props.ativoId])} {...props}/>;}
function Conteudo({userId,clienteId,tipo,ativoId}:Props){
  const client=useQueryClient();const chave=["codigos-publicos",userId,clienteId,tipo,ativoId,"aliases"];
  const q=useInfiniteQuery({queryKey:chave,gcTime:0,initialPageParam:null as string|null,queryFn:async({pageParam,signal})=>{
    const antes=await supabase.auth.getUser();
    if(antes.error || antes.data.user?.id!==userId || signal.aborted)throw new Error("Sessão indisponível ou alterada.");
    const mediada=import.meta.env.VITE_SSO_LEITURA_ALIASES_MEDIADA_ENABLED==="true";
    const parametros={p_cliente_id:clienteId,p_tipo:tipo,p_ativo_id:ativoId,p_apos:pageParam,p_limite:20};
    const consulta=mediada
      ? supabase.schema("pcm").rpc("sso_listar_aliases_ativo_mediada",{...parametros,p_ator_id:userId})
      : supabase.schema("pcm").rpc("sso_listar_aliases_ativo",parametros);
    const {data,error}=await consulta.abortSignal(signal);
    if(error)throw error;
    const pagina=z.array(z.object({id:z.string().guid(),codigo:z.string().min(1).max(200),criado_em:z.string().datetime({offset:true})}).strict()).max(20).parse(data);
    let anterior=pageParam?.toLowerCase() ?? null;
    for(const alias of pagina){const id=alias.id.toLowerCase();if(anterior!==null && id<=anterior)throw new Error("Página de aliases inconsistente.");anterior=id;}
    const depois=await supabase.auth.getUser();
    if(depois.error || depois.data.user?.id!==userId || signal.aborted)throw new Error("Sessão indisponível ou alterada.");
    return pagina;
  },getNextPageParam:p=>p.length===20 ? p[p.length-1]?.id : undefined});
  return <section aria-label="Códigos anteriores"><h3>Códigos anteriores</h3><p>Aliases preservados para este cadastro; não verifica outros Clientes. A paginação não é um retrato transacional; atualize para consultar mudanças.</p>{q.isFetching && <output>Consultando códigos anteriores…</output>}{q.isError && <p role="alert">Códigos anteriores indisponíveis. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}{!q.isFetching && !q.isError && q.data && <>{q.data.pages.flat().length===0 ? <p>Nenhum alias registrado para este cadastro.</p> : <ul>{q.data.pages.flat().map(a=><li key={a.id}>{a.codigo} · registrado em {new Date(a.criado_em).toLocaleDateString("pt-BR")}</li>)}</ul>}{q.hasNextPage && <button type="button" onClick={()=>void q.fetchNextPage()}>Mais códigos anteriores</button>}<button type="button" onClick={()=>void client.resetQueries({queryKey:chave,exact:true})}>Atualizar códigos anteriores</button></>}</section>;
}
