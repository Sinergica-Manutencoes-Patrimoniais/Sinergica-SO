import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { CancelarCandidataT24 } from "./CancelarCandidataT24";
import { RespostasTardiasT24 } from "./RespostasTardiasT24";

const uuid=z.string().uuid();
const linha=z.object({id:uuid,revisao:z.number().int().positive(),estado:z.enum(["aguardando","reservado","iniciado","incerto","reconciliacao","confirmado","bloqueado","cancelado"]),elegivel_em:z.string().datetime({offset:true})}).strict();
const diagnostico=z.object({tentativaId:uuid,visitaId:uuid,osId:uuid,revisaoObservada:z.number().int().positive(),revisaoTentativa:z.number().int().positive(),estado:linha.shape.estado,elegivelEm:z.string().datetime({offset:true}),bloqueios:z.array(z.string().regex(/^[a-z0-9_]+$/)).max(30),autorizaEnvio:z.literal(false)}).strict();
type Props={userId:string;clienteId:string;visitaId:string;osId:string};
async function sessao(userId:string,signal:AbortSignal){const {data,error}=await supabase.auth.getUser();if(error || data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");}

export function CandidatasT24(props:Props){
 if(import.meta.env.VITE_SSO_DIAGNOSTICO_CANDIDATAS_T24_ENABLED!=="true")return null;
 return <Lista key={JSON.stringify([props.userId,props.clienteId,props.visitaId,props.osId])} {...props}/>;
}
function Lista({userId,clienteId,visitaId,osId}:Props){
 const [selecionado,setSelecionado]=useState<string | null>(null);
 const consulta=useInfiniteQuery({queryKey:["t24-candidatas",userId,clienteId,visitaId,osId],gcTime:0,retry:false,initialPageParam:null as string | null,
  queryFn:async({pageParam,signal})=>{await sessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_t24_listar_candidatas",{p_ator_id:userId,p_cliente_id:clienteId,p_visita_id:visitaId,p_os_id:osId,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;
   const pagina=z.array(linha).max(20).parse(data);let anterior=pageParam?.toLowerCase() ?? "";for(const item of pagina){if(item.id.toLowerCase()<=anterior)throw new Error("Página divergente.");anterior=item.id.toLowerCase();}await sessao(userId,signal);return pagina;},
  getNextPageParam:(pagina)=>pagina.length===20?pagina.at(-1)?.id:undefined});
 const selecionadoVisivel=!!selecionado && !!consulta.data?.pages.flat().some((item)=>item.id===selecionado);
 const detalhe=useQuery({queryKey:["t24-diagnostico",userId,clienteId,visitaId,osId,selecionado],enabled:selecionadoVisivel && !consulta.isFetching && !consulta.isError,gcTime:0,retry:false,
  queryFn:async({signal})=>{await sessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_t24_diagnosticar_candidata",{p_ator_id:userId,p_cliente_id:clienteId,p_tentativa_id:selecionado}).abortSignal(signal);if(error)throw error;const r=diagnostico.parse(data);if(r.tentativaId!==selecionado || r.visitaId!==visitaId || r.osId!==osId)throw new Error("Diagnóstico divergente.");await sessao(userId,signal);return r;}});
 const categoria=useQuery({queryKey:["t24-categoria-candidata",userId,clienteId,visitaId,osId,selecionado],enabled:import.meta.env.VITE_SSO_CATEGORIA_CANDIDATA_T24_ENABLED==="true" && selecionadoVisivel && !consulta.isFetching && !consulta.isError,gcTime:0,retry:false,
  queryFn:async({signal})=>{await sessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_t24_categoria_candidata",{p_ator_id:userId,p_cliente_id:clienteId,p_tentativa_id:selecionado}).abortSignal(signal);if(error)throw error;
   const r=z.object({tentativaId:uuid,clienteId:uuid,visitaId:uuid,osId:uuid,categoriaFotografada:z.enum(["corretiva","emergencial"]).nullable(),categoriaAtual:z.string(),categoriaCoincide:z.boolean().nullable(),autorizaEnvio:z.literal(false)}).strict().parse(data);
   if(r.tentativaId!==selecionado||r.clienteId!==clienteId||r.visitaId!==visitaId||r.osId!==osId||(r.categoriaFotografada===null)!==(r.categoriaCoincide===null)||(r.categoriaFotografada!==null&&r.categoriaCoincide!==(r.categoriaFotografada===r.categoriaAtual)))throw new Error("Categoria divergente.");await sessao(userId,signal);return r;}});
 return <section aria-label="Candidatas de envio T24"><h4>Candidatas T−24</h4><p>Consulta local, sem envio. Ausência de candidata não comprova ausência de tarefa externa.</p>
  {consulta.isFetching && <p role="status">Consultando candidatas…</p>}{consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
  {!consulta.isFetching && !consulta.isError && consulta.data && (consulta.data.pages.flat().length===0?<p>Nenhuma candidata registrada nesta consulta.</p>:<ul>{consulta.data.pages.flat().map((item)=><li key={item.id}>Tentativa {item.id} · revisão {item.revisao} · {item.estado} · janela {new Date(item.elegivel_em).toLocaleString("pt-BR")} <button type="button" onClick={()=>setSelecionado(item.id)}>Consultar bloqueios</button></li>)}</ul>)}
  {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={()=>void consulta.fetchNextPage()}>Mais candidatas</button>}
  {selecionado && detalhe.isFetching && <p role="status">Consultando bloqueios…</p>}{selecionado && detalhe.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={()=>void detalhe.refetch()}>Tentar novamente</button></p>}
  {selecionado && !consulta.isFetching && !consulta.isError && !selecionadoVisivel && <p>Seleção não encontrada nas páginas carregadas; consulte novamente.</p>}
  {selecionadoVisivel && !consulta.isFetching && !consulta.isError && !detalhe.isFetching && !detalhe.isError && detalhe.data && <p>Revisão atual {detalhe.data.revisaoObservada}; tentativa {detalhe.data.revisaoTentativa}. Bloqueios: {detalhe.data.bloqueios.join(", ").replaceAll("_"," ")}. Não autoriza envio.</p>}
  {selecionadoVisivel && !consulta.isFetching && !consulta.isError && import.meta.env.VITE_SSO_CATEGORIA_CANDIDATA_T24_ENABLED==="true" && <>
   {categoria.isFetching && <p role="status">Conferindo categoria…</p>}
   {categoria.isError && <p role="alert">Categoria indisponível. <button type="button" onClick={()=>void categoria.refetch()}>Tentar novamente</button></p>}
   {!categoria.isFetching && !categoria.isError && categoria.data && <p>Categoria atual da OS: {categoria.data.categoriaAtual}; categoria fotografada: {categoria.data.categoriaFotografada ?? "não disponível na tentativa histórica"}. {categoria.data.categoriaCoincide===false ? "Categoria mudou; candidata precisa ser reavaliada." : categoria.data.categoriaCoincide===true ? "Categorias coincidem nesta consulta." : "Não presumir categoria histórica."} Consulta não autoriza envio.</p>}
  </>}
  {selecionadoVisivel && selecionado && !consulta.isFetching && !consulta.isError && import.meta.env.VITE_SSO_CANCELAMENTO_T24_ENABLED==="true" && <CancelarCandidataT24 userId={userId} clienteId={clienteId} visitaId={visitaId} osId={osId} tentativaId={selecionado}/>}
  {selecionadoVisivel && selecionado && !consulta.isFetching && !consulta.isError && import.meta.env.VITE_SSO_RESPOSTAS_TARDIAS_T24_ENABLED==="true" && <RespostasTardiasT24 userId={userId} clienteId={clienteId} visitaId={visitaId} osId={osId} tentativaId={selecionado}/>}
 </section>;
}
