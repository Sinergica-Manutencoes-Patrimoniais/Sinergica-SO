import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema=z.object({requestId:z.string().guid(),clienteId:z.string().guid(),loteId:z.string().guid(),chave:z.string().min(1).max(200),
  revision:z.number().int().positive(),entidadeId:z.string().guid(),tipo:z.enum(["sistema","equipamento","componente","grupo_quantitativo"]),snapshot:z.record(z.string(), z.unknown())}).strict();
type Pedido=z.infer<typeof pedidoSchema>;
type Props={userId:string;clienteId:string;loteId:string;chave:string;revisao:number;entidadeId:string;tipo:string;observacoes?:boolean};
export function AtualizarNome(props:Props){if((props.observacoes ? import.meta.env.VITE_SSO_ATUALIZAR_OBSERVACOES_LEVANTAMENTO_ENABLED : import.meta.env.VITE_SSO_ATUALIZAR_NOME_LEVANTAMENTO_ENABLED)!=="true" || !props.entidadeId)return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.loteId,props.chave,props.entidadeId,props.observacoes])} {...props}/>;}
function Conteudo({userId,clienteId,loteId,chave,revisao,entidadeId,tipo,observacoes=false}:Props){
  const storageKey=`sso-atualizar-${observacoes ? "observacoes" : "nome"}-levantamento:${JSON.stringify([userId,clienteId,loteId,chave,entidadeId])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(storageKey);if(!v)return null;const p=pedidoSchema.parse(JSON.parse(v));return p.clienteId===clienteId && p.loteId===loteId && p.chave===chave && p.entidadeId===entidadeId && p.tipo===tipo ? p : "invalido";}catch{return "invalido";}});
  const [confirmado,setConfirmado]=useState(false);const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const snapshot=useQuery({queryKey:["levantamentos",userId,clienteId,loteId,chave,entidadeId,observacoes ? "snapshot-observacoes" : "snapshot",revisao],gcTime:0,queryFn:async({signal})=>{
    const {data,error}=await supabase.schema("pcm").rpc(observacoes ? "sso_consultar_ativo_observacoes_levantamento" : "sso_snapshot_ativo_levantamento",{p_cliente_id:clienteId,p_tipo:tipo,p_id:entidadeId}).abortSignal(signal);if(error)throw error;
    const r=z.record(z.string(), z.unknown()).parse(data);if(r.id!==entidadeId || typeof r.nome!=="string")throw new Error("Snapshot inválido");return r;}});
  const envio=useMutation({mutationFn:async(p:Pedido)=>{const {data,error}=await supabase.schema("pcm").rpc(observacoes ? "sso_atualizar_observacoes_ativo_levantamento" : "sso_atualizar_nome_ativo_levantamento",{p_request_id:p.requestId,p_lote_id:p.loteId,p_expected_revision:p.revision,p_chave:p.chave,p_entidade_id:p.entidadeId,p_snapshot:p.snapshot});if(error)throw error;
    const r=z.object({aggregateId:z.string().guid(),revision:z.number().int(),state:z.literal("pendente"),created:z.literal(false),linkedIds:z.object({entidadeId:z.string().guid(),tipo:z.string()}).strict(),warnings:z.array(z.string()),requestId:z.string().guid()}).strict().parse(data);
    if(r.aggregateId!==p.loteId || r.revision!==p.revision+1 || r.requestId!==p.requestId || r.linkedIds.entidadeId!==p.entidadeId || r.linkedIds.tipo!==p.tipo || (!observacoes && !r.warnings.includes("somente_nome_atualizado")))throw new Error("Resposta divergente");
  },onSuccess:async(_r,p)=>{try{if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(storageKey);}catch{setAviso("Atualização confirmada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setConfirmado(false);setAviso(observacoes ? "Nome e observações informadas foram atualizados." : "Somente o nome foi atualizado.");await client.invalidateQueries({queryKey:["levantamentos",userId,clienteId,"lotes"]});await client.invalidateQueries({queryKey:["pcm","ativos-cliente",clienteId]});},onError:()=>setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!snapshot.data || snapshot.isFetching || snapshot.isError || pendente || !confirmado || trava.current)return;try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),clienteId,loteId,chave,revision:revisao,entidadeId,tipo,snapshot:snapshot.data});if(sessionStorage.getItem(storageKey)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(storageKey,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Não foi possível guardar tentativa; nada foi enviado.");}}
  return <section aria-label={observacoes ? "Atualizar nome e observações do cadastro" : "Atualizar nome do cadastro"}><p>{observacoes ? "Atualiza nome e observações informados na linha; observações ausentes ou vazias preservam o valor atual. Código e outros campos não são alterados." : "Atualiza apenas o nome com o valor da linha. Não altera código ou outros campos; linhas que contenham outros dados são recusadas."}</p>
    {snapshot.isPending && <output>Consultando cadastro…</output>}{snapshot.isError && <p role="alert">Não foi possível conferir o cadastro. <button type="button" onClick={()=>void snapshot.refetch()}>Tentar novamente</button></p>}
    {snapshot.data && !snapshot.isFetching && <p>Nome atual: {String(snapshot.data.nome)} · Código: {snapshot.data.codigo == null ? "não informado" : String(snapshot.data.codigo)}</p>}
    {observacoes && snapshot.data && !snapshot.isFetching && <p>Observações atuais: {snapshot.data.observacoes == null ? "não informadas" : String(snapshot.data.observacoes)}</p>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir atualização</button> : !pendente && <><label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmado(e.target.checked)}/> Conferi os dados da linha e o cadastro selecionado.</label><button type="button" disabled={!confirmado || snapshot.isPending || snapshot.isFetching || snapshot.isError || envio.isPending} onClick={iniciar}>{observacoes ? "Atualizar nome e observações" : "Atualizar somente nome"}</button></>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
