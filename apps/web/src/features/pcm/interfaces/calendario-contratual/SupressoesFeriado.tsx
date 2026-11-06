import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha=z.object({supressao_id:z.string().uuid(),serie_id:z.string().uuid(),regra_id:z.string().uuid(),semana_origem:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),data_contratual:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),feriado_ativo:z.boolean(),revogada:z.boolean(),criado_em:z.string().datetime({offset:true}),visita_suprimida_id:z.string().uuid().nullable().optional()}).strict();
const pedido=z.object({requestId:z.string().uuid(),supressaoId:z.string().uuid(),motivo:z.string().trim().min(1).max(2000)}).strict();
type Pedido=z.infer<typeof pedido>;
type Props={userId:string;clienteId:string;feriadoId:string};
export function SupressoesFeriado(props:Props){
  const [aberto,setAberto]=useState(false);if(import.meta.env.VITE_SSO_SUPRESSOES_FERIADO_ENABLED!=="true")return null;
  return <><button type="button" aria-expanded={aberto} onClick={()=>setAberto(v=>!v)}>{aberto?"Ocultar supressões":"Consultar semanas suprimidas"}</button>{aberto&&<Lista key={JSON.stringify([props.userId,props.clienteId,props.feriadoId])} {...props}/>}</>;
}
function Lista({userId,clienteId,feriadoId}:Props){
  const chave=["supressoes-feriado",userId,clienteId,feriadoId];
  const q=useInfiniteQuery({queryKey:chave,gcTime:0,initialPageParam:null as string|null,queryFn:async({pageParam,signal})=>{
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("pcm").rpc(import.meta.env.VITE_SSO_HISTORICO_VISITA_SUPRIMIDA_ENABLED === "true" ? "sso_listar_supressoes_feriado_v2" : "sso_listar_supressoes_feriado",{p_ator_id:userId,p_cliente_id:clienteId,p_feriado_id:feriadoId,p_apos:pageParam,p_limite:30}).abortSignal(signal);
    if(error)throw error;const pagina=z.array(linha).max(30).parse(data);let anterior=pageParam?.toLowerCase()??null;
    for(const item of pagina){const id=item.supressao_id.toLowerCase();if(anterior!==null&&id<=anterior)throw new Error("Página inconsistente.");anterior=id;}
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return pagina;
  },getNextPageParam:p=>p.length===30?p[p.length-1]?.supressao_id:undefined});
  return <section aria-label="Histórico de semanas suprimidas"><p>Revogar não cria reposição nem prova que a data seja dia útil.</p>
    {q.isFetching&&<output>Consultando supressões…</output>}{q.isError&&<p role="alert">Consulta indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching&&!q.isError&&q.data&&<>{q.data.pages.flat().length===0?<p>Nenhuma supressão encontrada neste histórico.</p>:<ul>{q.data.pages.flat().map(s=><li key={s.supressao_id}>Semana {s.semana_origem} · data {s.data_contratual} · série {s.serie_id} · {s.revogada?"revogada":"ativa"}{s.visita_suprimida_id && <span> · Visita anterior preservada: {s.visita_suprimida_id}</span>}{!s.feriado_ativo&&<Revogar userId={userId} clienteId={clienteId} feriadoId={feriadoId} supressaoId={s.supressao_id} permitirNova={!s.revogada}/>}</li>)}</ul>}{q.hasNextPage&&<button type="button" onClick={()=>void q.fetchNextPage()}>Mais supressões</button>}</>}
  </section>;
}
function Revogar({userId,clienteId,feriadoId,supressaoId,permitirNova}:Props & {supressaoId:string;permitirNova:boolean}){
  const chave=`sso-revogacao-supressao:${JSON.stringify([userId,clienteId,supressaoId])}`;const [motivo,setMotivo]=useState("");const [aviso,setAviso]=useState("");const trava=useRef(false);const cache=useQueryClient();const montado=useRef(false);useEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const v=sessionStorage.getItem(chave);if(!v)return null;const p=pedido.parse(JSON.parse(v));return p.supressaoId===supressaoId?p:"invalido";}catch{return "invalido";}});
  const envio=useMutation({mutationFn:async(p:Pedido)=>{
    if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||!montado.current)throw new Error("Sessão alterada.");if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_revogar_supressao_semana",{p_ator_id:userId,p_cliente_id:clienteId,p_request_id:p.requestId,p_supressao_id:p.supressaoId,p_motivo:p.motivo});if(error)throw error;
    if(!data||data.requestId!==p.requestId||data.supressaoId!==p.supressaoId||data.revogada!==true||data.visitaCriada!==false||data.ocorrenciaCriada!==false||data.osCriada!==false||data.tarefaAuvoCriada!==false)throw new Error("Recibo divergente.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");
  },onSuccess:async(_r,p)=>{try{const sessao=await supabase.auth.getUser();if(sessao.error||sessao.data.user?.id!==userId||!montado.current||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();sessionStorage.removeItem(chave);}catch{setAviso("Revogação confirmada; tentativa não removida. Consulte suporte.");return;}void cache.invalidateQueries({queryKey:["supressoes-feriado",userId,clienteId,feriadoId]});setPendente(null);setMotivo("");setAviso("Revogação registrada. Nenhuma Visita foi criada.");},onError:()=>setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setAviso("Tentativa indisponível. Consulte suporte.");return;}trava.current=true;envio.mutate(p);}
  function iniciar(){if(!permitirNova||pendente||trava.current)return;try{const p=pedido.parse({requestId:crypto.randomUUID(),supressaoId,motivo});if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira o motivo e a sessão. Nada foi enviado.");}}
  if(!permitirNova&&!pendente&&!aviso)return null;
  return <div>{pendente==="invalido"?<p role="alert">Tentativa ilegível. Consulte suporte.</p>:pendente?<button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir revogação</button>:<form onSubmit={e=>{e.preventDefault();iniciar();}}><label>Motivo da revogação <input required maxLength={2000} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><button disabled={envio.isPending}>Revogar supressão</button></form>}{aviso&&<p role="status">{aviso}</p>}</div>;
}
