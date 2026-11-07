import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
const contexto = z.object({ clienteId:id, retornoId:id, chamadoId:id, propostaId:id, revision:z.number().int().safe().positive(),
  estadoRetorno:z.enum(["aguardando","promovido"]), situacaoProposta:z.enum(["pendente","rejeitada","executada","devolvida_backlog"]),
  descricaoRestante:z.string().min(1).max(4000), minutosRestantes:z.number().int().positive(), paradaComprovada:z.literal(false) }).strict();
const pedido = z.object({ requestId:id, clienteId:id, retornoId:id, chamadoId:id, propostaId:id, revision:z.number().int().safe().positive(), motivo:z.string().trim().min(1).max(2000) }).strict();
type Pedido=z.infer<typeof pedido>;
type Props={userId:string;clienteId:string;retornoId:string;chamadoId:string;propostaId:string};
export function ConfirmarContinuacaoDevolvida(props:Props){
  if(import.meta.env.VITE_SSO_CONTINUACAO_DEVOLVIDA_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.retornoId])} {...props}/>;
}
function Conteudo({userId,clienteId,retornoId,chamadoId,propostaId}:Props){
  const chave=`sso-continuacao-devolvida:${JSON.stringify([userId,clienteId,retornoId])}`;const cache=useQueryClient();const trava=useRef(false);
  const [motivo,setMotivo]=useState("");const [confirmacao,setConfirmacao]=useState<string|null>(null);const [aviso,setAviso]=useState("");
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const texto=sessionStorage.getItem(chave);if(!texto)return null;const p=pedido.parse(JSON.parse(texto));return p.clienteId===clienteId&&p.retornoId===retornoId&&p.chamadoId===chamadoId&&p.propostaId===propostaId?p:"invalido";}catch{return "invalido";}});
  const consulta=useQuery({queryKey:["continuacao-devolvida",userId,clienteId,retornoId],gcTime:0,retry:false,queryFn:async({signal})=>{
    const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_conferir_continuacao_devolvida",{p_ator_id:userId,p_cliente_id:clienteId,p_retorno_id:retornoId}).abortSignal(signal);
    if(error)throw error;const r=contexto.parse(data);if(r.clienteId!==clienteId||r.retornoId!==retornoId||r.chamadoId!==chamadoId||r.propostaId!==propostaId)throw new Error("Contexto divergente.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return r;
  }});
  const envio=useMutation({mutationFn:async(p:Pedido)=>{
    if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");const antes=await supabase.auth.getUser();if(antes.error||antes.data.user?.id!==userId)throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_registrar_continuacao_devolvida",{p_ator_id:userId,p_cliente_id:p.clienteId,p_request_id:p.requestId,p_retorno_id:p.retornoId,p_expected_revision:p.revision,p_motivo:p.motivo});if(error)throw error;
    const r=z.object({requestId:id,clienteId:id,retornoId:id,propostaId:id,chamadoId:id,revision:z.number().int().safe().positive(),situacao:z.literal("devolvida_backlog"),parcelaAlterada:z.literal(false),osCriada:z.literal(false),paradaComprovada:z.literal(false)}).strict().parse(data);
    if(r.requestId!==p.requestId||r.clienteId!==p.clienteId||r.retornoId!==p.retornoId||r.propostaId!==p.propostaId||r.chamadoId!==p.chamadoId||r.revision!==p.revision+1)throw new Error("Recibo divergente.");
    const depois=await supabase.auth.getUser();if(depois.error||depois.data.user?.id!==userId)throw new Error("Sessão alterada.");
  },onSuccess:async(_r,p)=>{try{await Promise.all([cache.invalidateQueries({queryKey:["continuacao-devolvida",userId,clienteId,retornoId]}),cache.invalidateQueries({queryKey:["backlog-retornos-parciais",userId,clienteId]})]);if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();sessionStorage.removeItem(chave);setPendente(null);setMotivo("");setConfirmacao(null);setAviso("Continuidade registrada como devolvida. Parcela e OS não foram alteradas.");}catch{setAviso("Registro confirmado, mas tentativa local não foi removida. Consulte suporte.");}},onError:()=>setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error();}catch{setAviso("Tentativa indisponível. Consulte suporte.");return;}trava.current=true;envio.mutate(p);}
  const confirmado=!!consulta.data&&confirmacao===JSON.stringify(consulta.data);
  function iniciar(){if(pendente||trava.current||!confirmado||consulta.isFetching||consulta.isError||!consulta.data||consulta.data.estadoRetorno!=="promovido"||consulta.data.situacaoProposta!=="pendente")return;
    try{const p=pedido.parse({requestId:crypto.randomUUID(),clienteId,retornoId,chamadoId,propostaId,revision:consulta.data.revision,motivo});if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira motivo e sessão. Nada foi enviado.");}}
  return <section aria-label="Continuidade devolvida"><p>Somente após promoção do retorno. Não altera parcela, não cria OS e não comprova parada remota.</p>
    {consulta.isFetching&&<output>Conferindo continuidade…</output>}{consulta.isError&&<p role="alert">Consulta indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching&&!consulta.isError&&consulta.data&&<p>{consulta.data.descricaoRestante} · {consulta.data.minutosRestantes} min · retorno {consulta.data.estadoRetorno} · proposta {consulta.data.situacaoProposta} · revisão do Chamado {consulta.data.revision}</p>}
    {pendente==="invalido"?<p role="alert">Tentativa ilegível. Consulte suporte.</p>:pendente?<button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir registro</button>:<form onSubmit={e=>{e.preventDefault();iniciar();}}>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={e=>{setMotivo(e.target.value);setConfirmacao(null);}}/></label>
      <label><input type="checkbox" checked={confirmado} disabled={!consulta.data||consulta.isFetching||consulta.isError} onChange={e=>setConfirmacao(e.target.checked&&consulta.data?JSON.stringify(consulta.data):null)}/> Conferi o retorno promovido e a continuidade.</label>
      <button type="submit" disabled={!confirmado||envio.isPending||consulta.isFetching||consulta.isError||consulta.data?.estadoRetorno!=="promovido"||consulta.data?.situacaoProposta!=="pendente"}>Registrar continuidade devolvida</button>
    </form>}{aviso&&<p role="status">{aviso}</p>}
  </section>;
}
