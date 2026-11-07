import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";

const pedidoSchema = z.object({ requestId: z.string().guid(), loteId: z.string().guid(), chave: z.string().min(1).max(200),
  loteRevision: z.number().int().positive(), revision: z.number().int().nonnegative(), codigo: z.string().min(1).max(200).regex(/^\S+$/) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; loteId: string; chave: string; revisao: number; tipo: string };
export function CodigoProvisorio(props: Props) {
  if (import.meta.env.VITE_SSO_CODIGO_STAGING_ENABLED !== "true" || !["sistema","equipamento","componente"].includes(props.tipo)) return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.loteId,props.chave])} {...props} />;
}
function Conteudo({ userId,clienteId,loteId,chave,revisao }: Props) {
  const storageKey=`sso-codigo-staging:${JSON.stringify([userId,clienteId,loteId,chave])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(() => { try {
    const valor=sessionStorage.getItem(storageKey); if (!valor) return null;
    const p=pedidoSchema.parse(JSON.parse(valor)); return p.loteId===loteId && p.chave===chave ? p : "invalido";
  } catch { return "invalido"; } });
  const [codigo,setCodigo]=useState(""); const [aviso,setAviso]=useState(""); const trava=useRef(false); const client=useQueryClient();
  const permissao=useQuery({queryKey:["levantamentos",userId,clienteId,"codigo-permissao"],queryFn:()=>supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir",clienteId),gcTime:0,refetchOnWindowFocus:true});
  const permitido=permissao.data===true && !permissao.isFetching && !permissao.isError;
  const consulta=useQuery({queryKey:["levantamentos",userId,clienteId,loteId,chave,"codigo-staging",revisao],enabled:permitido,gcTime:0,
    queryFn:async ({signal})=>{ const {data,error}=await supabase.schema("pcm").rpc("sso_codigo_staging_autorizado",{p_lote_id:loteId,p_chave:chave}).abortSignal(signal);
      if(error) throw error; return z.array(z.object({codigo:z.string(),revisao:z.number().int().positive()}).strict()).max(1).parse(data)[0] ?? null; }});
  const envio=useMutation({mutationFn:async(p:Pedido)=>{
    const {data,error}=await supabase.schema("pcm").rpc("sso_salvar_codigo_autorizado",{p_request_id:p.requestId,p_lote_id:p.loteId,p_chave:p.chave,p_lote_revisao:p.loteRevision,p_revisao:p.revision,p_codigo:p.codigo});
    if(error) throw error; const r=z.object({loteId:z.string().guid(),chave:z.string(),revision:z.number().int(),codigo:z.string(),requestId:z.string().guid()}).strict().parse(data);
    if(r.loteId!==p.loteId || r.chave!==p.chave || r.revision!==p.revision+1 || r.codigo!==p.codigo || r.requestId!==p.requestId) throw new Error("Resposta divergente");
  },onSuccess:async(_r,p)=>{try{if(sessionStorage.getItem(storageKey)!==JSON.stringify(p)) throw new Error("Tentativa divergente");sessionStorage.removeItem(storageKey);}catch{setAviso("Código salvo; tentativa local não foi limpa. Consulte suporte.");return;}
    setPendente(null);setCodigo("");setAviso("Candidato salvo em staging; esta ação não reserva nem incorpora o código.");await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,loteId,chave]});await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,"lotes"]});
  },onError:()=>setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(!permitido || trava.current)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!permitido || consulta.isFetching || consulta.isError || pendente || trava.current)return;try{
    const p=pedidoSchema.parse({requestId:crypto.randomUUID(),loteId,chave,loteRevision:revisao,revision:consulta.data?.revisao ?? 0,codigo:codigo.trim().toUpperCase()});
    if(sessionStorage.getItem(storageKey)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(storageKey,JSON.stringify(p));setPendente(p);enviar(p);
  }catch{setAviso("Confira o código e a sessão. Nada foi enviado.");}}
  if(permissao.isPending || permissao.isFetching)return <output>Verificando permissão…</output>;
  if(permissao.isError)return <p role="alert">Não foi possível verificar permissão. <button type="button" onClick={()=>void permissao.refetch()}>Tentar novamente</button></p>;
  if(!permitido)return null;
  return <section aria-label="Código provisório"><p>Candidato em staging: {consulta.data?.codigo ?? "não informado"}. Salvar candidato não cria ativo nem substitui o código da fonte; consulte o estado de reserva separadamente.</p>
    {consulta.isPending && <output>Carregando candidato…</output>}{consulta.isError && <p role="alert">Não foi possível consultar candidato. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir tentativa</button> :
      !pendente && <form onSubmit={(e)=>{e.preventDefault();iniciar();}}><label>Candidato <input required maxLength={200} value={codigo} onChange={(e)=>setCodigo(e.target.value)} /></label>
        <button type="submit" disabled={consulta.isPending || consulta.isFetching || consulta.isError || envio.isPending}>Salvar candidato</button></form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
