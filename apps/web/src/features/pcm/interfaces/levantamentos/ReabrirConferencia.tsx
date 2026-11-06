import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const schema=z.object({requestId:z.string().uuid(),loteId:z.string().uuid(),revision:z.number().int().positive(),motivo:z.string().min(1).max(2000)}).strict();type Pedido=z.infer<typeof schema>;
export function ReabrirConferencia({userId,clienteId,loteId,revisao}:{userId:string;clienteId:string;loteId:string;revisao:number}){
  if(import.meta.env.VITE_SSO_REABRIR_CONFERENCIA_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([userId,clienteId,loteId])} userId={userId} clienteId={clienteId} loteId={loteId} revisao={revisao}/>;
}
function Conteudo({userId,clienteId,loteId,revisao}:{userId:string;clienteId:string;loteId:string;revisao:number}){
  const chave=`sso-reabrir-conferencia:${JSON.stringify([userId,clienteId,loteId])}`;const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(chave);if(!v)return null;const p=schema.parse(JSON.parse(v));return p.loteId===loteId ? p : "invalido";}catch{return "invalido";}});
  const [motivo,setMotivo]=useState("");const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const envio=useMutation({mutationFn:async(p:Pedido)=>{const {data,error}=await supabase.schema("pcm").rpc("sso_reabrir_conferencia_autorizado",{p_request_id:p.requestId,p_lote_id:p.loteId,p_expected_revision:p.revision,p_motivo:p.motivo});if(error)throw error;
    const r=z.object({loteId:z.string().uuid(),revision:z.number().int().positive(),ciclo:z.number().int().positive(),requestId:z.string().uuid()}).strict().parse(data);if(r.loteId!==p.loteId || r.revision!==p.revision+1 || r.requestId!==p.requestId)throw new Error("Resposta divergente");
  },onSuccess:async(_r,p)=>{try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(chave);}catch{setAviso("Reabertura registrada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setMotivo("");setAviso("Novo ciclo aberto; linhas devem ser conferidas novamente.");await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,"lotes"]});},onError:()=>setAviso("Resultado não confirmado. Repita ou consulte suporte; lote com incorporação não pode ser reaberto."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(pendente || trava.current)return;try{const p=schema.parse({requestId:crypto.randomUUID(),loteId,revision:revisao,motivo:motivo.trim()});if(sessionStorage.getItem(chave)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira o motivo e a sessão. Nada foi enviado.");}}
  return <section><p>Reabrir inicia nova conferência e preserva histórico. Lotes com incorporação não podem ser reabertos.</p>{pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir reabertura</button> : !pendente && <form onSubmit={(e)=>{e.preventDefault();iniciar();}}><label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e)=>setMotivo(e.target.value)}/></label><button type="submit" disabled={envio.isPending}>Reabrir conferência</button></form>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
