import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { ReabrirConferencia } from "./ReabrirConferencia";
const scalar=z.union([z.string(),z.number(),z.boolean(),z.null()]);
const pedidoSchema=z.discriminatedUnion("tipo",[
  z.object({tipo:z.literal("linha"),requestId:z.string().uuid(),loteId:z.string().uuid(),revision:z.number().int().positive(),chave:z.string().min(1).max(200),atributos:z.record(z.string(), scalar)}).strict(),
  z.object({tipo:z.literal("lote"),requestId:z.string().uuid(),loteId:z.string().uuid(),revision:z.number().int().positive()}).strict(),
]);type Pedido=z.infer<typeof pedidoSchema>;
type Props={userId:string;clienteId:string;loteId:string;revisao:number;linha?:{chave:string;atributos:Record<string,unknown>}};
export function ConsolidarLote(props:Props){if(import.meta.env.VITE_SSO_CONFERENCIA_LOTE_ENABLED!=="true")return null;return <Permissao key={JSON.stringify([props.userId,props.clienteId,props.loteId,props.linha?.chave ?? "lote"])} {...props}/>;}
function Permissao(props:Props){const p=useQuery({queryKey:["levantamentos",props.userId,props.clienteId,"incorporacao-permissao"],queryFn:()=>supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar",props.clienteId),gcTime:0,refetchOnWindowFocus:true});
  if(p.isPending || p.isFetching)return <output>Verificando permissão de conferência…</output>;if(p.isError)return <p role="alert">Não foi possível verificar permissão. <button type="button" onClick={()=>void p.refetch()}>Tentar novamente</button></p>;return p.data===true ? <Conteudo {...props}/> : null;}
function Conteudo({userId,clienteId,loteId,revisao,linha}:Props){
  const chave=`sso-conferencia-lote:${JSON.stringify([userId,clienteId,loteId,linha?.chave ?? null])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(chave);if(!v)return null;const p=pedidoSchema.parse(JSON.parse(v));return p.loteId===loteId && ((p.tipo==="linha" && p.chave===linha?.chave) || (p.tipo==="lote" && !linha)) ? p : "invalido";}catch{return "invalido";}});
  const [confirmado,setConfirmado]=useState(false);const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const resumo=useQuery({queryKey:["levantamentos",userId,clienteId,loteId,"conferencia-resumo",revisao],enabled:!linha,gcTime:0,queryFn:async({signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_resumo_conferencia_autorizado",{p_lote_id:loteId}).abortSignal(signal);if(error)throw error;const r=z.object({loteId:z.string().uuid(),revision:z.number().int().positive(),total:z.number().int().nonnegative(),pendentes:z.number().int().nonnegative(),conferenciaRegistrada:z.boolean()}).strict().parse(data);if(r.loteId!==loteId || r.revision!==revisao)throw new Error("Revisão divergente");return r;}});
  const envio=useMutation({mutationFn:async(p:Pedido)=>{if(p.tipo==="linha"){const {data,error}=await supabase.schema("pcm").rpc("sso_conferir_linha_autorizada",{p_request_id:p.requestId,p_lote_id:p.loteId,p_expected_revision:p.revision,p_chave:p.chave,p_atributos:p.atributos});if(error)throw error;const r=z.object({loteId:z.string().uuid(),chave:z.string(),revision:z.number().int(),requestId:z.string().uuid()}).strict().parse(data);if(r.loteId!==p.loteId || r.chave!==p.chave || r.revision!==p.revision+1 || r.requestId!==p.requestId)throw new Error("Resposta divergente");}
    else {const {data,error}=await supabase.schema("pcm").rpc("sso_concluir_conferencia_autorizado",{p_request_id:p.requestId,p_lote_id:p.loteId,p_expected_revision:p.revision});if(error)throw error;const r=z.object({loteId:z.string().uuid(),revision:z.number().int(),total:z.number().int().positive(),requestId:z.string().uuid()}).strict().parse(data);if(r.loteId!==p.loteId || r.revision!==p.revision+1 || r.requestId!==p.requestId)throw new Error("Resposta divergente");}},
    onSuccess:async(_r,p)=>{try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(chave);}catch{setAviso("Registro confirmado; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setConfirmado(false);setAviso("Conferência registrada; nenhum cadastro foi incorporado nesta ação.");await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,"lotes"]});},onError:()=>setAviso("Resultado não confirmado. Repita ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!confirmado || pendente || trava.current || (!linha && (!resumo.data || resumo.isFetching || resumo.isError || resumo.data.pendentes!==0 || resumo.data.total===0)))return;try{
    const p=pedidoSchema.parse(linha ? {tipo:"linha",requestId:crypto.randomUUID(),loteId,revision:revisao,chave:linha.chave,atributos:linha.atributos} : {tipo:"lote",requestId:crypto.randomUUID(),loteId,revision:revisao});
    if(sessionStorage.getItem(chave)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);
  }catch{setAviso("Confira os dados e a sessão. Nada foi enviado.");}}
  return <section><h4>{linha ? "Conferência da linha" : "Aprovação da conferência do lote"}</h4><p>Conferência é declaração do PCM, não comprova automaticamente vínculos ou duplicidades e não incorpora cadastros. Escolha o candidato de código antes de conferir a linha.</p>
    {!linha && resumo.isPending && <output>Consultando pendências…</output>}{!linha && resumo.isError && <p role="alert">Não foi possível consultar pendências. <button type="button" onClick={()=>void resumo.refetch()}>Tentar novamente</button></p>}
    {!linha && resumo.data && !resumo.isFetching && <p>{resumo.data.total} linhas · {resumo.data.pendentes} pendentes · conferência {resumo.data.conferenciaRegistrada ? "registrada no ciclo atual" : "não registrada neste ciclo"}</p>}
    {!linha && resumo.data && <ReabrirConferencia userId={userId} clienteId={clienteId} loteId={loteId} revisao={revisao}/>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir tentativa</button> : !pendente && <><label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmado(e.target.checked)}/> Conferi os dados aplicáveis de localização, classificação, vínculo, código e duplicidade.</label><button type="button" disabled={!confirmado || envio.isPending || (!linha && (!resumo.data || resumo.isFetching || resumo.isError || resumo.data.pendentes!==0 || resumo.data.total===0 || resumo.data.conferenciaRegistrada))} onClick={iniciar}>{linha ? "Registrar conferência da linha" : "Aprovar conferência do lote"}</button></>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
