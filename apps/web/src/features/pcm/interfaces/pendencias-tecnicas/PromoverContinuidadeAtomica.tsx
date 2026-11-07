import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().guid();
const contextoSchema = z.object({ clienteId:id, retornoId:id, chamadoId:id, propostaId:id,
  revision:z.number().int().safe().positive(), estadoRetorno:z.enum(["aguardando","promovido"]),
  situacaoProposta:z.enum(["pendente","rejeitada","executada","devolvida_backlog"]),
  descricaoRestante:z.string().min(1).max(4000), minutosRestantes:z.number().int().positive(), paradaComprovada:z.literal(false) }).strict();
const pedidoSchema = z.object({ promocaoId:id, registroId:id, atorId:id, clienteId:id, retornoId:id,
  retornoRevision:z.number().int().safe().positive(), chamadoAnteriorId:id, chamadoAnteriorRevision:z.number().int().safe().positive(),
  propostaId:id, chamadoId:id, parcelaId:id, cicloId:id, titulo:z.string().trim().min(1).max(200),
  descricao:z.string().max(10000), motivo:z.string().trim().min(1).max(2000),
  descricaoRestante:z.string().min(1).max(4000), minutosRestantes:z.number().int().positive() }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
const promocaoSchema = z.object({ requestId:id, clienteId:id, retornoId:id, retornoRevision:z.number().int().positive(), pendenciaId:id,
  chamadoAnteriorId:id, parcelaAnteriorId:id, cicloAnteriorId:id, chamadoId:id, numero:z.string().min(1), parcelaId:id, cicloId:id,
  descricaoRestante:z.string(), minutosRestantes:z.number().int().positive(), osCriada:z.literal(false), tarefaCriada:z.literal(false) }).strict();
const registroSchema = z.object({ requestId:id, clienteId:id, retornoId:id, propostaId:id, chamadoId:id,
  revision:z.number().int().safe().positive(), situacao:z.literal("devolvida_backlog"), parcelaAlterada:z.literal(false),
  osCriada:z.literal(false), paradaComprovada:z.literal(false) }).strict();

export function PromoverContinuidadeAtomica({userId, clienteId, retornoId, chamadoId, propostaId, revisao, descricaoRestante, minutosRestantes, consultaDisponivel}: {
  userId:string; clienteId:string; retornoId:string; chamadoId:string; propostaId:string; revisao:number;
  descricaoRestante:string; minutosRestantes:number; consultaDisponivel:boolean;
}) {
  const chave = `sso-promocao-continuidade-atomica:${JSON.stringify([userId,clienteId,retornoId])}`;
  const [pendente,setPendente] = useState<Pedido | "invalido" | null>(() => { try {
    const texto=sessionStorage.getItem(chave); if(!texto)return null; const p=pedidoSchema.parse(JSON.parse(texto));
    return p.atorId===userId && p.clienteId===clienteId && p.retornoId===retornoId && p.chamadoAnteriorId===chamadoId && p.propostaId===propostaId ? p : "invalido";
  } catch { return "invalido"; } });
  const [titulo,setTitulo]=useState(""); const [descricao,setDescricao]=useState(""); const [motivo,setMotivo]=useState("");
  const [confirmacao,setConfirmacao]=useState<string|null>(null); const [ocupado,setOcupado]=useState(false); const [aviso,setAviso]=useState("");
  const trava=useRef(false); const cache=useQueryClient();
  async function conferirSessao(){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==userId)throw new Error("Sessão alterada");}
  const consulta=useQuery({queryKey:["continuidade-atomica",userId,clienteId,retornoId],gcTime:0,retry:false,queryFn:async({signal})=>{
    await conferirSessao(); if(signal.aborted)throw new Error("Cancelado");
    const {data,error}=await supabase.schema("pcm").rpc("sso_conferir_continuacao_devolvida",{p_ator_id:userId,p_cliente_id:clienteId,p_retorno_id:retornoId}).abortSignal(signal);
    if(error)throw error; const r=contextoSchema.parse(data); await conferirSessao();
    if(signal.aborted||r.clienteId!==clienteId||r.retornoId!==retornoId||r.chamadoId!==chamadoId||r.propostaId!==propostaId)throw new Error("Contexto divergente"); return r;
  }});
  const contexto=consulta.data;
  const fotografia=JSON.stringify({contexto,revisao,descricaoRestante,minutosRestantes,titulo:titulo.trim(),descricao,motivo:motivo.trim()});
  const disponivel=consultaDisponivel&&!consulta.isFetching&&!consulta.isError&&contexto?.estadoRetorno==="aguardando"&&contexto.situacaoProposta==="pendente"&&
    contexto.descricaoRestante===descricaoRestante&&contexto.minutosRestantes===minutosRestantes&&[...descricaoRestante].length<=1000&&descricaoRestante===descricaoRestante.trim();
  async function enviar(p:Pedido){
    if(trava.current)return;trava.current=true;setOcupado(true);setAviso("");const serializado=JSON.stringify(p);
    try{
      await conferirSessao();if(sessionStorage.getItem(chave)!==serializado)throw new Error("Pedido divergente");
      const {data,error}=await supabase.schema("pcm").rpc("sso_promover_e_registrar_continuacao_parcial",{
        p_promocao_request_id:p.promocaoId,p_registro_request_id:p.registroId,p_ator_id:p.atorId,p_cliente_id:p.clienteId,
        p_retorno_id:p.retornoId,p_retorno_revision:p.retornoRevision,p_chamado_anterior_id:p.chamadoAnteriorId,
        p_chamado_anterior_revision:p.chamadoAnteriorRevision,p_chamado_id:p.chamadoId,p_parcela_id:p.parcelaId,p_ciclo_id:p.cicloId,
        p_titulo:p.titulo,p_descricao:p.descricao,p_motivo:p.motivo});
      if(error)throw error;const r=z.object({promocao:promocaoSchema,registro:registroSchema}).strict().parse(data);
      if(r.promocao.requestId!==p.promocaoId||r.registro.requestId!==p.registroId||r.promocao.clienteId!==p.clienteId||r.registro.clienteId!==p.clienteId||
        r.promocao.retornoId!==p.retornoId||r.registro.retornoId!==p.retornoId||r.promocao.retornoRevision!==p.retornoRevision+1||
        r.promocao.chamadoAnteriorId!==p.chamadoAnteriorId||r.registro.chamadoId!==p.chamadoAnteriorId||r.registro.propostaId!==p.propostaId||
        r.registro.revision!==p.chamadoAnteriorRevision+1||r.promocao.chamadoId!==p.chamadoId||r.promocao.parcelaId!==p.parcelaId||r.promocao.cicloId!==p.cicloId||
        r.promocao.descricaoRestante!==p.descricaoRestante||r.promocao.minutosRestantes!==p.minutosRestantes)throw new Error("Recibo divergente");
      await conferirSessao();await Promise.all([cache.invalidateQueries({queryKey:["backlog-retornos-parciais",userId,clienteId]}),cache.invalidateQueries({queryKey:["continuidade-atomica",userId,clienteId,retornoId]})]);
      await conferirSessao();if(sessionStorage.getItem(chave)!==serializado)throw new Error("Pedido divergente");
      sessionStorage.removeItem(chave);setPendente(null);setConfirmacao(null);setAviso(`Chamado ${r.promocao.numero} criado e continuidade registrada. Nenhuma OS ou tarefa foi criada.`);
    }catch{setAviso("Resultado não confirmado. Preserve e repita somente o mesmo pedido ou procure suporte.");}finally{trava.current=false;setOcupado(false);}
  }
  function iniciar(){if(trava.current||pendente||!disponivel||!contexto||confirmacao!==fotografia)return;try{
    const p=pedidoSchema.parse({promocaoId:crypto.randomUUID(),registroId:crypto.randomUUID(),atorId:userId,clienteId,retornoId,retornoRevision:revisao,
      chamadoAnteriorId:chamadoId,chamadoAnteriorRevision:contexto.revision,propostaId,chamadoId:crypto.randomUUID(),parcelaId:crypto.randomUUID(),
      cicloId:crypto.randomUUID(),titulo,descricao,motivo,descricaoRestante,minutosRestantes});
    if(sessionStorage.getItem(chave)!==null)throw new Error("Pedido existente");sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);void enviar(p);
  }catch{setAviso("Confira título, motivo e armazenamento da sessão.");}}
  return <section aria-label="Promoção atômica da continuidade"><p>Promove somente o restante e registra a continuidade na mesma transação. Não comprova parada remota.</p>
    {consulta.isFetching&&<output>Conferindo continuidade…</output>}{consulta.isError&&<p role="alert">Consulta indisponível. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {pendente==="invalido"?<p role="alert">Pedido ilegível; procure suporte.</p>:pendente?<><p>Pedido pendente: {pendente.descricaoRestante} · {pendente.minutosRestantes} min.</p><button type="button" disabled={ocupado} onClick={()=>void enviar(pendente)}>Repetir o mesmo pedido</button></>:<>
      {!disponivel&&!consulta.isFetching&&<p role="alert">Retorno indisponível ou divergente; atualize a consulta antes de promover.</p>}
      {contexto&&<p>Chamado anterior {contexto.chamadoId}, revisão {contexto.revision} · {descricaoRestante} · {minutosRestantes} min.</p>}
      <label>Título <input maxLength={200} value={titulo} disabled={ocupado} onChange={e=>{setTitulo(e.target.value);setConfirmacao(null);}} /></label>
      <label>Descrição <textarea maxLength={10000} value={descricao} disabled={ocupado} onChange={e=>{setDescricao(e.target.value);setConfirmacao(null);}} /></label>
      <label>Motivo <textarea maxLength={2000} value={motivo} disabled={ocupado} onChange={e=>{setMotivo(e.target.value);setConfirmacao(null);}} /></label>
      <label><input type="checkbox" checked={confirmacao===fotografia} disabled={!disponivel||ocupado} onChange={e=>setConfirmacao(e.target.checked?fotografia:null)} /> Conferi o restante e as revisões.</label>
      <button type="button" disabled={!disponivel||ocupado||!titulo.trim()||!motivo.trim()||confirmacao!==fotografia} onClick={iniciar}>Promover e registrar continuidade</button>
    </>}{aviso&&<p role="status">{aviso}</p>}</section>;
}
