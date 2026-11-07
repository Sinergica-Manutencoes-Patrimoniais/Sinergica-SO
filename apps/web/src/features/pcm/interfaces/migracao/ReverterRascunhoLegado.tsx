import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id=z.string().guid();
const pedidoSchema=z.object({requestId:id,clienteId:id,planoId:id,origemRequestId:id,revisao:z.number().int().positive(),motivo:z.string().trim().min(1).max(2000)}).strict();
const origemSchema=z.object({clienteId:id,planoId:id,origemRequestId:id,revisao:z.number().int().positive(),estado:z.string(),versaoId:id,rotinaId:id}).strict();
type Pedido=z.infer<typeof pedidoSchema>;

export function ReverterRascunhoLegado({userId,clienteId,planoId}:{userId:string;clienteId:string;planoId:string}) {
  const chave=`sso-reversao-rascunho:${JSON.stringify([userId,clienteId,planoId])}`;
  const [pendente,setPendente]=useState<Pedido|"invalido"|null>(()=>{try{const texto=sessionStorage.getItem(chave);if(!texto)return null;
    const p=pedidoSchema.parse(JSON.parse(texto));return p.clienteId===clienteId&&p.planoId===planoId?p:"invalido";}catch{return "invalido";}});
  const [motivo,setMotivo]=useState("");const [confirmado,setConfirmado]=useState(false);const [ocupado,setOcupado]=useState(false);const [aviso,setAviso]=useState("");
  const trava=useRef(false);const cache=useQueryClient();
  const consulta=useQuery({queryKey:["migracao-rascunho-reversao",userId,clienteId,planoId],gcTime:0,retry:false,
    queryFn:async({signal})=>{const a=await supabase.auth.getUser();if(a.error||a.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_rascunho_plano_legado",{p_ator_id:userId,p_cliente_id:clienteId,p_plano_id:planoId}).abortSignal(signal);
      if(error)throw error;const r=origemSchema.parse(data);if(r.clienteId!==clienteId||r.planoId!==planoId)throw new Error("Origem divergente.");
      const b=await supabase.auth.getUser();if(b.error||b.data.user?.id!==userId||signal.aborted)throw new Error("Sessão alterada.");return r;}});
  async function enviar(p:Pedido){if(trava.current)return;try{
    if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente.");trava.current=true;setOcupado(true);setAviso("");
    const a=await supabase.auth.getUser();if(a.error||a.data.user?.id!==userId)throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_reverter_rascunho_plano_legado",{p_ator_id:userId,p_cliente_id:clienteId,p_request_id:p.requestId,p_origem_request_id:p.origemRequestId,p_expected_revision:p.revisao,p_motivo:p.motivo});
    if(error)throw error;const r=z.object({requestId:id,aggregateId:id,revision:z.number().int().positive(),state:z.enum(["revertido_logicamente","pendente_reconciliacao"]),created:z.literal(false),
      linkedIds:z.object({clienteId:id,origemRequestId:id}).strict(),warnings:z.array(z.string())}).strict().parse(data);
    if(r.requestId!==p.requestId||r.aggregateId!==planoId||r.linkedIds.clienteId!==clienteId||r.linkedIds.origemRequestId!==p.origemRequestId||
      (r.state==="revertido_logicamente"?r.revision!==p.revisao+1:r.revision!==p.revisao))throw new Error("Recibo divergente.");
    const b=await supabase.auth.getUser();if(b.error||b.data.user?.id!==userId)throw new Error("Sessão alterada.");
    await Promise.all([cache.invalidateQueries({queryKey:["migracao-rascunho-reversao",userId,clienteId,planoId]}),cache.invalidateQueries({queryKey:["migracao-fotografia-plano",userId,clienteId,planoId]})]);
    const c=await supabase.auth.getUser();if(c.error||c.data.user?.id!==userId||sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
    sessionStorage.removeItem(chave);setPendente(null);setConfirmado(false);setMotivo("");
    setAviso(r.state==="pendente_reconciliacao"?"Pendência registrada. O Plano não foi alterado.":"Rascunho encerrado logicamente. Histórico preservado.");
  }catch{setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte.");}finally{trava.current=false;setOcupado(false);}}
  function iniciar(){if(!consulta.data||consulta.isFetching||consulta.isError||pendente||ocupado||!confirmado)return;try{
    const p=pedidoSchema.parse({requestId:crypto.randomUUID(),clienteId,planoId,origemRequestId:consulta.data.origemRequestId,revisao:consulta.data.revisao,motivo});
    if(sessionStorage.getItem(chave)!==null)throw new Error();sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);void enviar(p);
  }catch{setAviso("Confira o motivo e a tentativa. Nada foi enviado.");}}
  return <section aria-label="Reversão de rascunho legado"><h4>Revisar reversão</h4>
    <p>Não apaga histórico. Sem cobertura comprovada de todas as dependências, apenas uma pendência de reconciliação será registrada.</p>
    {pendente==="invalido"&&<p role="alert">Tentativa ilegível. Consulte suporte.</p>}
    {pendente&&pendente!=="invalido"?<><p>Tentativa pendente na revisão {pendente.revisao}; motivo: {pendente.motivo}.</p><button type="button" disabled={ocupado} onClick={()=>void enviar(pendente)}>Repetir tentativa</button></>:!pendente&&<>
      {consulta.isFetching&&<output>Consultando origem…</output>}{consulta.isError&&<p role="alert">Origem indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching&&!consulta.isError&&consulta.data&&<form onSubmit={(e)=>{e.preventDefault();iniciar();}}><p>Estado {consulta.data.estado}, revisão {consulta.data.revisao}.</p>
        <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e)=>{setMotivo(e.target.value);setConfirmado(false);}} /></label>
        <label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmado(e.target.checked)} /> Conferi o Plano e a revisão.</label>
        <button type="submit" disabled={!confirmado||ocupado}>Solicitar avaliação</button></form>}
    </>}{aviso&&<p role="status">{aviso}</p>}
  </section>;
}
