import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { PreviaDevolucao } from "./PreviaDevolucao";
import { DiagnosticoDevolucao } from "./DiagnosticoDevolucao";
import { SuspensaoChamado } from "./SuspensaoChamado";
import { HistoricoSuspensao } from "./HistoricoSuspensao";
import { PendenciasSemParcela } from "./PendenciasSemParcela";
import { RetirarPendenciaComposicao } from "./RetirarPendenciaComposicao";
const contextoSchema=z.discriminatedUnion("vinculado",[z.object({vinculado:z.literal(false),composicaoRevision:z.number().int().positive()}).strict(),
  z.object({vinculado:z.literal(true),composicaoRevision:z.number().int().positive(),chamadoId:z.string().guid(),chamadoNumero:z.string(),chamadoRevision:z.number().int().positive(),escopoRevision:z.number().int().positive().nullable()}).strict()]);
const pedidoSchema=z.discriminatedUnion("tipo",[
  z.object({tipo:z.literal("chamado"),requestId:z.string().guid(),composicaoId:z.string().guid(),composicaoRevision:z.number().int().positive(),chamadoId:z.string().guid(),chamadoRevision:z.number().int().positive()}).strict(),
  z.object({tipo:z.literal("parcela"),requestId:z.string().guid(),composicaoId:z.string().guid(),composicaoRevision:z.number().int().positive(),chamadoRevision:z.number().int().positive(),escopoRevision:z.number().int().positive(),pendenciaId:z.string().guid(),parcelaId:z.string().guid()}).strict(),
]);type Pedido=z.infer<typeof pedidoSchema>;
export function VinculoChamado(props:{userId:string;clienteId:string;composicaoId:string}){if(import.meta.env.VITE_SSO_VINCULAR_BACKLOG_CHAMADO_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.composicaoId])} {...props}/>;}
function Conteudo({userId,clienteId,composicaoId}:{userId:string;clienteId:string;composicaoId:string}){
  const chave=`sso-vinculo-backlog:${JSON.stringify([userId,clienteId,composicaoId])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(chave);if(!v)return null;const p=pedidoSchema.parse(JSON.parse(v));return p.composicaoId===composicaoId ? p : "invalido";}catch{return "invalido";}});
  const [chamado,setChamado]=useState("");const [pendencia,setPendencia]=useState("");const [parcela,setParcela]=useState("");const [confirmacao,setConfirmacao]=useState<string | null>(null);const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  async function conferirAtor(signal?:AbortSignal){const {data,error}=await supabase.auth.getUser();if(error || data.user?.id!==userId || signal?.aborted)throw new Error("Sessão alterada");}
  function conferirPagina<T extends {id:string}>(itens:T[],cursor:string | null):T[]{
    let anterior=cursor?.toLowerCase() ?? "";
    for(const item of itens){const atual=item.id.toLowerCase();if(atual<=anterior)throw new Error("Página fora de ordem");anterior=atual;}
    return itens;
  }
  const contexto=useQuery({queryKey:["backlog-vinculo",userId,clienteId,composicaoId,"contexto"],gcTime:0,queryFn:async({signal})=>{await conferirAtor(signal);const {data,error}=await supabase.schema("pcm").rpc("sso_contexto_vinculo_backlog",{p_composicao_id:composicaoId}).abortSignal(signal);if(error)throw error;const resultado=contextoSchema.parse(data);await conferirAtor(signal);return resultado;}});
  const vinculada=contexto.data?.vinculado===true;
  const chamados=useInfiniteQuery({queryKey:["backlog-vinculo",userId,clienteId,composicaoId,"chamados"],enabled:contexto.data?.vinculado===false,gcTime:0,initialPageParam:null as string | null,
    queryFn:async({pageParam,signal})=>{await conferirAtor(signal);const {data,error}=await supabase.schema("pcm").rpc("sso_chamados_para_backlog",{p_cliente_id:clienteId,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const itens=conferirPagina(z.array(z.object({id:z.string().guid(),numero:z.string(),titulo:z.string(),revisao:z.number().int().positive()}).strict()).max(20).parse(data),pageParam);await conferirAtor(signal);return itens;},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.id : undefined});
  function useItens(tipo:"pendencia" | "parcela") {return useInfiniteQuery({queryKey:["backlog-vinculo",userId,clienteId,composicaoId,tipo],enabled:vinculada,gcTime:0,initialPageParam:null as string | null,
    queryFn:async({pageParam,signal})=>{await conferirAtor(signal);const {data,error}=await supabase.schema("pcm").rpc("sso_itens_para_vinculo_backlog",{p_composicao_id:composicaoId,p_tipo:tipo,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const itens=conferirPagina(z.array(z.object({id:z.string().guid(),descricao:z.string()}).strict()).max(20).parse(data),pageParam);await conferirAtor(signal);return itens;},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.id : undefined});}
  const pendencias=useItens("pendencia");const parcelas=useItens("parcela");
  const fotografia=JSON.stringify([userId,clienteId,composicaoId,contexto.data ?? null,chamado,pendencia,parcela,
    chamados.data?.pages.flat().find((c)=>c.id===chamado) ?? null,
    pendencias.data?.pages.flat().find((item)=>item.id===pendencia) ?? null,
    parcelas.data?.pages.flat().find((item)=>item.id===parcela) ?? null]);
  const confirmado=confirmacao===fotografia;
  const envio=useMutation({mutationFn:async(p:Pedido)=>{
    await conferirAtor();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente");
    if(p.tipo==="chamado"){const {data,error}=await supabase.schema("pcm").rpc("sso_vincular_backlog_chamado",{p_request_id:p.requestId,p_composicao_id:p.composicaoId,p_composicao_revision:p.composicaoRevision,p_chamado_id:p.chamadoId,p_chamado_revision:p.chamadoRevision});if(error)throw error;const r=z.object({composicaoId:z.string().guid(),chamadoId:z.string().guid(),requestId:z.string().guid(),osCriada:z.literal(false)}).strict().parse(data);if(r.composicaoId!==p.composicaoId || r.chamadoId!==p.chamadoId || r.requestId!==p.requestId)throw new Error("Resposta divergente");}
    else {const {data,error}=await supabase.schema("pcm").rpc("sso_vincular_pendencia_parcela",{p_request_id:p.requestId,p_composicao_id:p.composicaoId,p_composicao_revision:p.composicaoRevision,p_chamado_revision:p.chamadoRevision,p_escopo_revision:p.escopoRevision,p_pendencia_id:p.pendenciaId,p_parcela_id:p.parcelaId});if(error)throw error;const r=z.object({pendenciaId:z.string().guid(),parcelaId:z.string().guid(),requestId:z.string().guid(),atendida:z.literal(false)}).strict().parse(data);if(r.pendenciaId!==p.pendenciaId || r.parcelaId!==p.parcelaId || r.requestId!==p.requestId)throw new Error("Resposta divergente");}
    await conferirAtor();
  },onSuccess:async(_r,p)=>{try{await client.invalidateQueries({queryKey:["backlog-vinculo",userId,clienteId,composicaoId]});await conferirAtor();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(chave);}catch{setAviso("Vínculo confirmado; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setChamado("");setPendencia("");setParcela("");setConfirmacao(null);setAviso("Vínculo registrado, sem criar OS nem declarar atendimento.");},onError:()=>setAviso("Resultado não confirmado. Repita ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!contexto.data || contexto.isFetching || contexto.isError || pendente || !confirmado || trava.current)return;try{let p:Pedido;
    if(!contexto.data.vinculado){const c=chamados.data?.pages.flat().find((x)=>x.id===chamado);if(!c || chamados.isFetching || chamados.isError)throw new Error("Chamado indisponível");p=pedidoSchema.parse({tipo:"chamado",requestId:crypto.randomUUID(),composicaoId,composicaoRevision:contexto.data.composicaoRevision,chamadoId:c.id,chamadoRevision:c.revisao});}
    else{if(!contexto.data.escopoRevision || pendencias.isFetching || parcelas.isFetching || pendencias.isError || parcelas.isError || !pendencias.data?.pages.flat().some((x)=>x.id===pendencia) || !parcelas.data?.pages.flat().some((x)=>x.id===parcela))throw new Error("Parcela indisponível");p=pedidoSchema.parse({tipo:"parcela",requestId:crypto.randomUUID(),composicaoId,composicaoRevision:contexto.data.composicaoRevision,chamadoRevision:contexto.data.chamadoRevision,escopoRevision:contexto.data.escopoRevision,pendenciaId:pendencia,parcelaId:parcela});}
    if(sessionStorage.getItem(chave)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);
  }catch{setAviso("Confira seleção, revisões e sessão. Nada foi enviado.");}}
  if(contexto.isPending || contexto.isFetching)return <output>Consultando vínculo…</output>;
  if(contexto.isError)return <p role="alert">Não foi possível consultar vínculo. <button type="button" onClick={()=>void contexto.refetch()}>Tentar novamente</button></p>;
  return <section><h4>Vínculo ao Chamado</h4><p>A associação não cria OS e não prova atendimento. Confirme correspondência técnica de cada item.</p>
    {contexto.data.vinculado && <PreviaDevolucao userId={userId} clienteId={clienteId} composicaoId={composicaoId}/>}
    <PendenciasSemParcela userId={userId} clienteId={clienteId} composicaoId={composicaoId}/>
    <RetirarPendenciaComposicao userId={userId} clienteId={clienteId} composicaoId={composicaoId}/>
    {contexto.data.vinculado && <DiagnosticoDevolucao userId={userId} clienteId={clienteId} composicaoId={composicaoId}/>}
    {contexto.data.vinculado && <SuspensaoChamado userId={userId} clienteId={clienteId} chamadoId={contexto.data.chamadoId}/>}
    {contexto.data.vinculado && <HistoricoSuspensao userId={userId} clienteId={clienteId} chamadoId={contexto.data.chamadoId}/>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir vínculo</button> : !pendente && <form onSubmit={(e)=>{e.preventDefault();iniciar();}}>
      {!contexto.data.vinculado ? <><label>Chamado existente <select required value={chamado} onChange={(e)=>setChamado(e.target.value)}><option value="">Selecione</option>{chamados.data?.pages.flat().map((c)=><option key={c.id} value={c.id}>{c.numero} · {c.titulo}</option>)}</select></label>{chamados.hasNextPage && <button type="button" disabled={chamados.isFetching} onClick={()=>void chamados.fetchNextPage()}>Mais Chamados</button>}{chamados.isError && <p role="alert">Não foi possível consultar Chamados. <button type="button" onClick={()=>void chamados.refetch()}>Tentar novamente</button></p>}</> : <><p>Chamado {contexto.data.chamadoNumero} · revisão {contexto.data.chamadoRevision}</p>
        {contexto.data.escopoRevision===null ? <p>Escopo do Chamado indisponível.</p> : <><label>Pendência <select required value={pendencia} onChange={(e)=>setPendencia(e.target.value)}><option value="">Selecione</option>{pendencias.data?.pages.flat().map((i)=><option key={i.id} value={i.id}>{i.descricao} · {i.id}</option>)}</select></label>
        <label>Parcela <select required value={parcela} onChange={(e)=>setParcela(e.target.value)}><option value="">Selecione</option>{parcelas.data?.pages.flat().map((i)=><option key={i.id} value={i.id}>{i.descricao}</option>)}</select></label>
        {pendencias.hasNextPage && <button type="button" disabled={pendencias.isFetching} onClick={()=>void pendencias.fetchNextPage()}>Mais Pendências</button>}{parcelas.hasNextPage && <button type="button" disabled={parcelas.isFetching} onClick={()=>void parcelas.fetchNextPage()}>Mais parcelas</button>}{(pendencias.isError || parcelas.isError) && <p role="alert">Não foi possível consultar itens. <button type="button" onClick={()=>{if(pendencias.isError)void pendencias.refetch();if(parcelas.isError)void parcelas.refetch();}}>Tentar novamente</button></p>}</>}</>}
      <label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmacao(e.target.checked ? fotografia : null)}/> Conferi Cliente e correspondência do escopo.</label><button type="submit" disabled={!confirmado || envio.isPending}>Registrar vínculo</button></form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
