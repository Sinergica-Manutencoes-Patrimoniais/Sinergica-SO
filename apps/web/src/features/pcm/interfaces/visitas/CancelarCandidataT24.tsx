import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid=z.string().guid();
const pedidoSchema=z.object({requestId:uuid,clienteId:uuid,visitaId:uuid,osId:uuid,tentativaId:uuid,fence:z.number().int().safe().nonnegative(),motivo:z.string().trim().min(1).max(2000)}).strict();
const previaSchema=z.object({tentativaId:uuid,visitaId:uuid,osId:uuid,estado:z.enum(["aguardando","reservado","iniciado","incerto","reconciliacao","confirmado","bloqueado","cancelado"]),fence:z.number().int().safe().nonnegative(),efeitoRemotoComprovado:z.literal(false)}).strict();
const reciboSchema=z.object({requestId:uuid,tentativaId:uuid,fence:z.number().int().safe().positive(),estado:z.enum(["cancelado","incerto"]),efeitoRemotoComprovado:z.literal(false)}).strict();
type Pedido=z.infer<typeof pedidoSchema>;
type Props={userId:string;clienteId:string;visitaId:string;osId:string;tentativaId:string};
export function CancelarCandidataT24(props:Props){return <Conteudo key={JSON.stringify(Object.values(props))} {...props}/>;}
function Conteudo({userId,clienteId,visitaId,osId,tentativaId}:Props){
 const chave=`sso-t24-cancelamento:${JSON.stringify([userId,clienteId,visitaId,osId,tentativaId])}`;const cache=useQueryClient();const trava=useRef(false);
 const [motivo,setMotivo]=useState("");const [confirmacao,setConfirmacao]=useState<string|null>(null);const [mensagem,setMensagem]=useState("");
 const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const s=sessionStorage.getItem(chave);if(!s)return null;const p=pedidoSchema.parse(JSON.parse(s));return p.clienteId===clienteId&&p.visitaId===visitaId&&p.osId===osId&&p.tentativaId===tentativaId?p:"invalido";}catch{return "invalido";}});
 async function sessao(signal?:AbortSignal){const {data,error}=await supabase.auth.getUser();if(error||data.user?.id!==userId||signal?.aborted)throw new Error("Sessão alterada.");}
 const previa=useQuery({queryKey:["t24-cancelamento",userId,clienteId,visitaId,osId,tentativaId],enabled:!pendente,gcTime:0,staleTime:0,retry:false,
  queryFn:async({signal})=>{await sessao(signal);const {data,error}=await supabase.schema("pcm").rpc("sso_t24_prever_cancelamento",{p_cliente_id:clienteId,p_visita_id:visitaId,p_os_id:osId,p_tentativa_id:tentativaId}).abortSignal(signal);if(error)throw error;
   const r=previaSchema.parse(data);if(r.tentativaId!==tentativaId||r.visitaId!==visitaId||r.osId!==osId)throw new Error("Prévia divergente.");await sessao(signal);return r;}});
 const comando=useMutation({mutationFn:async(p:Pedido)=>{await sessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido divergente.");
  const {data,error}=await supabase.schema("pcm").rpc("sso_t24_cancelar_candidata",{p_request_id:p.requestId,p_cliente_id:p.clienteId,p_tentativa_id:p.tentativaId,p_fence:p.fence,p_motivo:p.motivo});if(error)throw error;
  const r=reciboSchema.parse(data);
  if(r.requestId!==p.requestId||r.tentativaId!==p.tentativaId||r.fence!==p.fence+1)throw new Error("Resposta divergente.");await sessao();return r;
 },onSuccess:async(r,p)=>{try{await cache.invalidateQueries({queryKey:["t24-candidatas",userId,clienteId,visitaId,osId]});await sessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido divergente.");sessionStorage.removeItem(chave);}catch{setMensagem("Resultado registrado, mas tentativa não foi removida. Consulte suporte.");return;}
  setPendente(null);setConfirmacao(null);setMensagem(r.estado==="incerto"?"Efeito iniciado: resultado incerto, exige reconciliação. Nenhum cancelamento remoto foi comprovado.":"Candidata cancelada localmente. Tarefa Auvo não foi cancelada.");
 },onError:()=>setMensagem("Resultado não confirmado. Preserve o pedido e repita ou consulte suporte."),onSettled:()=>{trava.current=false;}});
 const recuperar=useMutation({mutationFn:async(p:Pedido)=>{await sessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido divergente.");
  const {data,error}=await supabase.schema("pcm").rpc("sso_t24_consultar_cancelamento",{p_request_id:p.requestId,p_cliente_id:p.clienteId,p_visita_id:p.visitaId,p_os_id:p.osId,p_tentativa_id:p.tentativaId,p_fence:p.fence,p_motivo:p.motivo});if(error)throw error;
  const r=reciboSchema.parse(data);if(r.requestId!==p.requestId||r.tentativaId!==p.tentativaId||r.fence!==p.fence+1)throw new Error("Recibo divergente.");await sessao();return r;
 },onSuccess:async(r,p)=>{try{await cache.invalidateQueries({queryKey:["t24-candidatas",userId,clienteId,visitaId,osId]});await sessao();if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Pedido divergente.");sessionStorage.removeItem(chave);}catch{setMensagem("Recibo localizado, mas tentativa não foi removida. Consulte suporte.");return;}
  setPendente(null);setConfirmacao(null);setMensagem(r.estado==="incerto"?"Recibo localizado: efeito incerto, exige reconciliação; cancelamento remoto não comprovado.":"Recibo localizado: candidata cancelada localmente; tarefa Auvo não foi cancelada.");
 },onError:()=>setMensagem("Recibo indisponível. Preserve o pedido; isso não comprova ausência de efeito remoto."),onSettled:()=>{trava.current=false;}});
 function enviar(p:Pedido){if(trava.current)return;try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setMensagem("Pedido local divergente. Consulte suporte.");return;}trava.current=true;comando.mutate(p);}
 const comprovacao=previa.data?JSON.stringify([previa.data,motivo.trim()]):null;
 function iniciar(){if(pendente||trava.current||previa.isFetching||previa.isError||!previa.data||!comprovacao||confirmacao!==comprovacao||!["aguardando","reservado","iniciado"].includes(previa.data.estado))return;
  try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),clienteId,visitaId,osId,tentativaId,fence:previa.data.fence,motivo});if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);}catch{setMensagem("Confira o motivo e armazenamento; nada foi enviado.");}}
 return <section aria-label="Cancelamento local de candidata"><h5>Cancelar candidata local</h5><p>Não cancela a OS nem a tarefa Auvo. Efeito já iniciado exige reconciliação.</p>
  {!pendente&&previa.isFetching&&<output>Consultando estado…</output>}{!pendente&&previa.isError&&<p role="alert">Prévia indisponível. <button type="button" onClick={()=>void previa.refetch()}>Tentar novamente</button></p>}
  {!pendente&&!previa.isFetching&&!previa.isError&&previa.data&&<><p>Estado: {previa.data.estado} · versão de concorrência: {previa.data.fence}.</p>
   <label>Motivo <textarea maxLength={2000} value={motivo} onChange={e=>{setMotivo(e.target.value);setConfirmacao(null);}}/></label>
   <label><input type="checkbox" checked={!!comprovacao&&confirmacao===comprovacao} onChange={e=>setConfirmacao(e.target.checked?comprovacao:null)}/> Conferi o estado e o motivo.</label>
   <button type="button" disabled={!comprovacao||confirmacao!==comprovacao||!motivo.trim()||!["aguardando","reservado","iniciado"].includes(previa.data.estado)} onClick={iniciar}>Registrar cancelamento local</button></>}
  {pendente==="invalido"&&<p role="alert">Tentativa ilegível. Consulte suporte.</p>}{pendente&&pendente!=="invalido"&&<><button type="button" disabled={comando.isPending||recuperar.isPending} onClick={()=>enviar(pendente)}>Repetir mesmo pedido</button>
   <button type="button" disabled={comando.isPending||recuperar.isPending} onClick={()=>{if(!trava.current){trava.current=true;recuperar.mutate(pendente);}}}>Consultar recibo</button></>}
  {mensagem&&<p role="status">{mensagem}</p>}
 </section>;
}
