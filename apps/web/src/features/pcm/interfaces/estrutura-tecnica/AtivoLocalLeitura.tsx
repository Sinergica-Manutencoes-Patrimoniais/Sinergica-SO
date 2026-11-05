import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { PreventivasLegadasLocal } from "./PreventivasLegadasLocal";

type Props={userId:string;clienteId:string;localId:string;itemId:string};
const ativo=z.object({id:z.string().uuid(),nome:z.string(),tipo:z.enum(["equipamento","componente"]),identificador:z.string().nullable(),categoria:z.string().nullable(),observacoes:z.string().nullable()}).strict();
const os=z.object({id:z.string().uuid(),numero:z.string(),categoria:z.string().nullable(),status:z.string().nullable(),data_agendada:z.string().nullable(),created_at:z.string().nullable(),direta:z.boolean(),auvo:z.boolean()}).strict();
async function conferir(userId:string,signal:AbortSignal){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");}
export function AtivoLocalLeitura(props:Props){
  if(import.meta.env.VITE_SSO_LOCAL_ATIVO_LEITURA_ENABLED!=="true")return null;
  return <Abrir key={JSON.stringify([props.userId,props.clienteId,props.localId,props.itemId])} {...props}/>;
}
function Abrir(props:Props){const [aberto,setAberto]=useState(false);return <section><button type="button" aria-expanded={aberto} onClick={()=>setAberto(v=>!v)}>{aberto?"Ocultar cadastro e OS":"Ver cadastro e OS neste Local"}</button>{aberto&&<Conteudo {...props}/>}</section>;}
function Conteudo({userId,clienteId,localId,itemId}:Props){
  const parametros={p_ator:userId,p_cliente:clienteId,p_local:localId,p_ativo:itemId};
  const resumo=useQuery({queryKey:["estrutura-tecnica",userId,clienteId,localId,itemId,"resumo-local"],gcTime:0,queryFn:async({signal})=>{await conferir(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_local_ativo_resumo",parametros).abortSignal(signal);if(error)throw error;const pagina=z.array(ativo).max(1).parse(data);if(pagina[0]&&pagina[0].id!==itemId)throw new Error("Ativo divergente.");await conferir(userId,signal);return pagina[0]??null;}});
  const ordens=useInfiniteQuery({queryKey:["estrutura-tecnica",userId,clienteId,localId,itemId,"os-local"],enabled:!!resumo.data&&!resumo.isFetching&&!resumo.isError,gcTime:0,initialPageParam:null as string|null,queryFn:async({pageParam,signal})=>{await conferir(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_local_ativo_os",{...parametros,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const pagina=z.array(os).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";for(const o of pagina){const atual=o.id.toLowerCase();if(atual<=anterior)throw new Error("Página divergente.");anterior=atual;}await conferir(userId,signal);return pagina;},getNextPageParam:pagina=>pagina.length===20?pagina.at(-1)?.id:undefined});
  const itens=ordens.data?.pages.flat()??[];const divergentes=itens.some((o,i)=>i>0&&o.id.toLowerCase()<=itens[i-1]!.id.toLowerCase());
  return <section aria-label="Cadastro e OS do ativo"><p>Somente registros visíveis ao usuário neste Cliente e Local. A consulta não inclui OS sem vínculo e páginas não formam retrato transacional.</p>
    {resumo.isFetching&&<output>Carregando cadastro…</output>}{resumo.isError&&<p role="alert">Cadastro indisponível ou sem acesso. <button type="button" onClick={()=>void resumo.refetch()}>Tentar novamente</button></p>}
    {!resumo.isFetching&&!resumo.isError&&resumo.data===null&&<p>Cadastro indisponível neste Local.</p>}
    {!resumo.isFetching&&!resumo.isError&&resumo.data&&<><dl><div><dt>Nome</dt><dd>{resumo.data.nome}</dd></div><div><dt>Tipo</dt><dd>{resumo.data.tipo}</dd></div><div><dt>Código</dt><dd>{resumo.data.identificador||"Não informado"}</dd></div><div><dt>Categoria</dt><dd>{resumo.data.categoria||"Não informada"}</dd></div><div><dt>Observações</dt><dd>{resumo.data.observacoes||"Não informadas"}</dd></div></dl><p>Criticidade e completude não estão disponíveis nesta fonte.</p></>}
    {!!resumo.data&&!resumo.isFetching&&!resumo.isError&&<><PreventivasLegadasLocal userId={userId} clienteId={clienteId} localId={localId} itemId={itemId}/>{ordens.isFetching&&<output>Carregando OS…</output>}{(ordens.isError||divergentes)&&<p role="alert">Histórico indisponível ou páginas divergentes. <button type="button" onClick={()=>void ordens.refetch()}>Tentar novamente</button></p>}
    {!ordens.isFetching&&!ordens.isError&&!divergentes&&ordens.data&&<>{itens.length===0?<p>Nenhuma OS vinculada visível nesta fonte.</p>:<ul>{itens.map(o=><li key={o.id}>{o.numero} · {o.categoria??"Categoria não informada"} · {o.status??"Estado não informado"} · {o.data_agendada??o.created_at??"Data não informada"} · {[o.direta?"vínculo direto":null,o.auvo?"vínculo Auvo":null].filter(Boolean).join(" e ")}</li>)}</ul>}{ordens.hasNextPage&&<button type="button" onClick={()=>void ordens.fetchNextPage()}>Mais OS</button>}</>}</>}
  </section>;
}
