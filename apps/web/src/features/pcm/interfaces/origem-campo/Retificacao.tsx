import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ResolucaoOs } from "./ResolucaoOs";

const itemSchema=z.object({envelope_id:z.string().uuid(),cliente_id:z.string().uuid(),revisao:z.number().int().positive(),motivo:z.string(),criado_em:z.string().datetime({offset:true})}).strict();
const pedidoSchema=z.object({requestId:z.string().uuid(),envelopeId:z.string().uuid(),revision:z.number().int().positive(),clienteId:z.string().uuid(),motivo:z.string().min(1).max(2000)}).strict();type Pedido=z.infer<typeof pedidoSchema>;
async function conferirSessao(userId:string,signal?:AbortSignal){const {data,error}=await supabase.auth.getUser();if(error||data.user?.id!==userId||signal?.aborted)throw new Error("Sessão alterada");}
export function RetificacaoTriagem({userId,clientes,clientesDisponiveis}:{userId:string;clientes:{id:string;nome:string}[];clientesDisponiveis:boolean}){
  if(import.meta.env.VITE_SSO_RETIFICAR_TRIAGEM_ENABLED!=="true")return null;
  return <Lista key={userId} userId={userId} clientes={clientes} clientesDisponiveis={clientesDisponiveis}/>;
}
function Lista({userId,clientes,clientesDisponiveis}:{userId:string;clientes:{id:string;nome:string}[];clientesDisponiveis:boolean}){
  const lista=useInfiniteQuery({queryKey:["triagem-origem",userId,"indicadas"],gcTime:0,initialPageParam:null as string | null,queryFn:async({pageParam,signal})=>{
    await conferirSessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_listar_triagens_campo_mediada",{p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const itens=z.array(itemSchema).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";for(const item of itens){const id=item.envelope_id.toLowerCase();if(id<=anterior)throw new Error("Página divergente");anterior=id;}await conferirSessao(userId,signal);return itens;},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.envelope_id : undefined});
  const itens=lista.data?.pages.flat()??[];const consistentes=itens.every((item,i)=>i===0||itens[i-1]!.envelope_id.toLowerCase()<item.envelope_id.toLowerCase());
  return <section><h3>Indicações anteriores</h3><p>Retificação fica indisponível quando há processamento conhecido; o controle completo de processamento ainda precisa ser validado.</p>
    <RecuperarRetificacoes userId={userId}/>
    {lista.isPending && <output>Carregando indicações…</output>}{lista.isError && <p role="alert">Não foi possível consultar indicações. <button type="button" onClick={()=>void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isError && lista.data?.pages.flat().length===0 && <p>Nenhuma indicação nesta fonte.</p>}
    {!consistentes && <p role="alert">Páginas de indicações divergentes. <button type="button" onClick={()=>void lista.refetch()}>Reconsultar</button></p>}
    {lista.data && <div hidden={lista.isFetching || lista.isError || !clientesDisponiveis || !consistentes}>{itens.map((i)=><Alterar key={i.envelope_id} userId={userId} item={i} clientes={clientes} disponivel={!lista.isFetching && !lista.isError && clientesDisponiveis && consistentes}/>)}</div>}
    {lista.hasNextPage && <button type="button" disabled={lista.isFetchingNextPage} onClick={()=>void lista.fetchNextPage()}>Mais indicações</button>}
  </section>;
}
/** Recupera confirmações mesmo quando o envelope não aparece na página carregada. */
function RecuperarRetificacoes({userId}:{userId:string}){
  const client=useQueryClient();
  const [aviso,setAviso]=useState("");
  const [,atualizar]=useState(0);
  const trava=useRef(false);
  const itens:{chave:string;pedido:Pedido}[]=[];
  let ilegivel=false;
  try{
    for(let i=0;i<sessionStorage.length;i++){
      const chave=sessionStorage.key(i);
      if(!chave?.startsWith("sso-retificar-triagem:"))continue;
      let contexto:unknown;
      try{contexto=JSON.parse(chave.slice("sso-retificar-triagem:".length));}catch{continue;}
      if(!Array.isArray(contexto) || contexto[0]!==userId)continue;
      try{
        const pedido=pedidoSchema.parse(JSON.parse(sessionStorage.getItem(chave) ?? ""));
        if(contexto.length!==2 || pedido.envelopeId!==contexto[1])throw new Error("Envelope divergente");
        itens.push({chave,pedido});
      }catch{ilegivel=true;}
    }
  }catch{ilegivel=true;}
  const consulta=useMutation({
    mutationFn:async(t:typeof itens[number])=>{
      await conferirSessao(userId);if(sessionStorage.getItem(t.chave)!==JSON.stringify(t.pedido))throw new Error("Tentativa divergente");
      const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_tentativa_triagem_mediada",{p_request_id:t.pedido.requestId});
      if(error)throw error;
      const resposta=z.object({envelopeId:z.string().uuid(),clienteId:z.string().uuid(),revision:z.number().int().positive(),requestId:z.string().uuid(),eventoAplicado:z.literal(false)}).strict().parse(data);
      if(resposta.envelopeId!==t.pedido.envelopeId || resposta.clienteId!==t.pedido.clienteId || resposta.revision!==t.pedido.revision+1 || resposta.requestId!==t.pedido.requestId)throw new Error("Resposta divergente");
      await conferirSessao(userId);return t;
    },
    onSuccess:async(t)=>{
      try{
        await client.invalidateQueries({queryKey:["triagem-origem",userId,"indicadas"],refetchType:"none"});await conferirSessao(userId);
        if(sessionStorage.getItem(t.chave)!==JSON.stringify(t.pedido))throw new Error("Tentativa divergente");
        sessionStorage.removeItem(t.chave);
        atualizar((valor)=>valor+1);
        setAviso("Retificação confirmada; evento não aplicado.");
      }catch{setAviso("Retificação confirmada, mas a tentativa local mudou ou não pôde ser limpa. Consulte suporte.");return;}
      void client.refetchQueries({queryKey:["triagem-origem",userId,"indicadas"],type:"active"});
    },
    onError:()=>setAviso("Confirmação indisponível ou sem acesso. Consulte suporte antes de nova retificação."),
    onSettled:()=>{trava.current=false;},
  });
  function consultar(t:typeof itens[number]){
    if(trava.current)return;
    trava.current=true;
    consulta.mutate(t);
  }
  return <section aria-label="Recuperar retificações de triagem">
    {ilegivel && <p role="alert">Há retificação local ilegível. Consulte suporte.</p>}
    {itens.map((t)=><p key={t.pedido.requestId}>Retificação pendente {t.pedido.requestId} <button type="button" disabled={consulta.isPending} onClick={()=>consultar(t)}>Consultar confirmação</button></p>)}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}
function Alterar({userId,item,clientes,disponivel}:{userId:string;item:z.infer<typeof itemSchema>;clientes:{id:string;nome:string}[];disponivel:boolean}){
  const chave=`sso-retificar-triagem:${JSON.stringify([userId,item.envelope_id])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(chave);if(!v)return null;const p=pedidoSchema.parse(JSON.parse(v));return p.envelopeId===item.envelope_id ? p : "invalido";}catch{return "invalido";}});
  const [clienteId,setClienteId]=useState("");const [motivo,setMotivo]=useState("");const [confirmacao,setConfirmacao]=useState<string|null>(null);const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const diagnosticoHabilitado=import.meta.env.VITE_SSO_DIAGNOSTICO_RETIFICACAO_CAMPO_ENABLED==="true";
  const diagnostico=useQuery({queryKey:["triagem-origem",userId,item.envelope_id,"diagnostico",item.cliente_id,item.revisao],enabled:diagnosticoHabilitado,gcTime:0,retry:false,queryFn:async({signal})=>{await conferirSessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_diagnosticar_retificacao_campo",{p_cliente_id:item.cliente_id,p_envelope_id:item.envelope_id,p_expected_revision:item.revisao}).abortSignal(signal);if(error)throw error;const r=z.object({envelopeId:z.string().uuid(),clienteId:z.string().uuid(),revision:z.number().int().positive(),recepcaoConhecida:z.boolean(),processamentoConhecido:z.boolean(),coberturaCompleta:z.literal(false)}).strict().parse(data);if(r.envelopeId!==item.envelope_id||r.clienteId!==item.cliente_id||r.revision!==item.revisao)throw new Error("Diagnóstico divergente");await conferirSessao(userId,signal);return r;}});
  const diagnosticoDisponivel=!diagnosticoHabilitado||!!diagnostico.data&&!diagnostico.isFetching&&!diagnostico.isError&&!diagnostico.data.recepcaoConhecida&&!diagnostico.data.processamentoConhecido;
  const fotografia=JSON.stringify([userId,item,clientes.find((c)=>c.id===clienteId)??null,motivo.trim()]);const confirmado=confirmacao===fotografia;
  const envio=useMutation({mutationFn:async(p:Pedido)=>{await conferirSessao(userId);if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente");const {data,error}=await supabase.schema("pcm").rpc("sso_retificar_cliente_campo_mediada",{p_request_id:p.requestId,p_envelope_id:p.envelopeId,p_expected_revision:p.revision,p_cliente_id:p.clienteId,p_motivo:p.motivo});if(error)throw error;
    const r=z.object({envelopeId:z.string().uuid(),clienteId:z.string().uuid(),revision:z.number().int().positive(),requestId:z.string().uuid(),eventoAplicado:z.literal(false)}).strict().parse(data);
    if(r.envelopeId!==p.envelopeId || r.clienteId!==p.clienteId || r.requestId!==p.requestId || r.revision!==p.revision+1)throw new Error("Resposta divergente");await conferirSessao(userId);
  },onSuccess:async(_r,p)=>{try{await client.invalidateQueries({queryKey:["triagem-origem",userId,"indicadas"],refetchType:"none"});await conferirSessao(userId);if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(chave);}catch{setAviso("Retificação confirmada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setConfirmacao(null);setAviso("Indicação retificada; evento não aplicado.");void client.refetchQueries({queryKey:["triagem-origem",userId,"indicadas"],type:"active"});},onError:()=>setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current || !disponivel)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(pendente || trava.current || !disponivel || !diagnosticoDisponivel || !confirmado || !clientes.some((c)=>c.id===clienteId && c.id!==item.cliente_id))return;try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),envelopeId:item.envelope_id,revision:item.revisao,clienteId,motivo:motivo.trim()});if(sessionStorage.getItem(chave)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira Cliente, motivo e sessão. Nada foi enviado.");}}
  return <article><p>Envelope {item.envelope_id} · Cliente atual {clientes.find((c)=>c.id===item.cliente_id)?.nome ?? item.cliente_id} · revisão {item.revisao} · motivo {item.motivo}</p>
    <ResolucaoOs userId={userId} clienteId={item.cliente_id} envelopeId={item.envelope_id} revision={item.revisao}/>
    {diagnosticoHabilitado && diagnostico.isFetching && <p>Conferindo recepção e processamento conhecidos…</p>}{diagnosticoHabilitado && diagnostico.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={()=>void diagnostico.refetch()}>Reconsultar</button></p>}{diagnosticoHabilitado && diagnostico.data && !diagnostico.isFetching && !diagnostico.isError && (diagnostico.data.recepcaoConhecida||diagnostico.data.processamentoConhecido) && <p role="alert">Há recepção ou processamento conhecido para esta tarefa. Retificação exige reconciliação.</p>}{diagnosticoHabilitado && diagnostico.data && !diagnostico.isFetching && !diagnostico.isError && diagnosticoDisponivel && <p>Nenhuma recepção ou processamento conhecido nesta consulta parcial; o servidor confere novamente ao registrar.</p>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending || !disponivel} onClick={()=>enviar(pendente)}>Repetir retificação</button> : !pendente && <form onSubmit={(e)=>{e.preventDefault();iniciar();}}>
      <label>Cliente correto <select required value={clienteId} onChange={(e)=>setClienteId(e.target.value)}><option value="">Selecione</option>{clientes.filter((c)=>c.id!==item.cliente_id).map((c)=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e)=>setMotivo(e.target.value)}/></label><label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmacao(e.target.checked?fotografia:null)}/> Conferi o Cliente atual, o Cliente correto e o motivo.</label><button type="submit" disabled={!confirmado || !disponivel || !diagnosticoDisponivel || envio.isPending}>Retificar indicação</button>
    </form>}{aviso && <p role="status">{aviso}</p>}
  </article>;
}
