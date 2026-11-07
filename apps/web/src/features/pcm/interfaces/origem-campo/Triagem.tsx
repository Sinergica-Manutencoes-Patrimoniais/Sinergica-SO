import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { RetificacaoTriagem } from "./Retificacao";
import { RecuperarRecepcaoEnvelope } from "./RecuperarRecepcaoEnvelope";
import { RecuperarRecepcaoEstruturada } from "./RecuperarRecepcaoEstruturada";
import { RecuperarAcoesChamadoCampo } from "./RecuperarAcoesChamadoCampo";

const itemSchema=z.object({id:z.string().guid(),integracao:z.string(),task_id:z.union([z.number().int().safe().positive(),z.string().regex(/^[1-9][0-9]*$/)]),cliente_externo_id:z.string().nullable(),recebido_em:z.string().datetime({offset:true})}).strict();
const pedidoSchema=z.object({requestId:z.string().guid(),envelopeId:z.string().guid(),clienteId:z.string().guid(),motivo:z.string().min(1).max(2000)}).strict();type Pedido=z.infer<typeof pedidoSchema>;
async function conferirSessao(userId:string,signal?:AbortSignal){const {data,error}=await supabase.auth.getUser();if(error || data.user?.id!==userId || signal?.aborted)throw new Error("Sessão alterada");}
function conferirOrdem(ids:string[],apos:string|null){let anterior=apos?.toLowerCase() ?? null;for(const original of ids){const id=original.toLowerCase();if(anterior!==null && id<=anterior)throw new Error("Página divergente");anterior=id;}}
export function TriagemOrigemCampo({userId}:{userId:string}){if(import.meta.env.VITE_SSO_TRIAGEM_ORIGEM_CAMPO_ENABLED!=="true")return null;return <Permissao key={userId} userId={userId}/>;}
function Permissao({userId}:{userId:string}){const p=useQuery({queryKey:["triagem-origem",userId,"permissao"],gcTime:0,refetchOnWindowFocus:true,queryFn:async({signal})=>{await conferirSessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_permissao_triagem_mediada").abortSignal(signal);if(error)throw error;const permitido=z.boolean().parse(data);await conferirSessao(userId,signal);return permitido;}});
  if(p.isPending)return <output>Verificando permissão de triagem…</output>;if(p.isError)return <p role="alert">Não foi possível verificar permissão. <button type="button" onClick={()=>void p.refetch()}>Tentar novamente</button></p>;return p.data ? <>{p.isFetching && <output>Verificando permissão de triagem…</output>}<div hidden={p.isFetching}><fieldset disabled={p.isFetching}><Conteudo userId={userId}/></fieldset></div></> : null;}
function Conteudo({userId}:{userId:string}){
  const clientes=useInfiniteQuery({queryKey:["triagem-origem",userId,"clientes"],gcTime:0,initialPageParam:null as string | null,
    queryFn:async({pageParam,signal})=>{await conferirSessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_listar_clientes_triagem_mediada",{p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const linhas=z.array(z.object({id:z.string().guid(),nome:z.string()}).strict()).max(20).parse(data);conferirOrdem(linhas.map((linha)=>linha.id),pageParam);await conferirSessao(userId,signal);return linhas;},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.id : undefined});
  const eventos=useInfiniteQuery({queryKey:["triagem-origem",userId,"eventos"],gcTime:0,initialPageParam:null as string | null,
    queryFn:async({pageParam,signal})=>{await conferirSessao(userId,signal);const {data,error}=await supabase.schema("pcm").rpc("sso_listar_envelopes_triagem_mediada",{p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const linhas=z.array(itemSchema).max(20).parse(data);conferirOrdem(linhas.map((linha)=>linha.id),pageParam);await conferirSessao(userId,signal);return linhas;},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.id : undefined});
  const clientesCarregados=clientes.data?.pages.flat()??[];const eventosCarregados=eventos.data?.pages.flat()??[];
  const ordenados=(ids:string[])=>ids.every((id,i)=>i===0||ids[i-1]!.toLowerCase()<id.toLowerCase());
  const consistentes=ordenados(clientesCarregados.map((c)=>c.id))&&ordenados(eventosCarregados.map((e)=>e.id));
  return <section><h2>Triagem de origem de campo</h2><p>Indicação manual não comprova a origem nem aplica evento. Não cria Chamado ou OS.</p>
    <RecuperarTentativas userId={userId}/>
    <RecuperarRecepcaoEnvelope userId={userId}/>
    <RecuperarRecepcaoEstruturada userId={userId}/>
    <RecuperarAcoesChamadoCampo userId={userId}/>
    {import.meta.env.VITE_SSO_RESOLUCAO_OS_ORIGEM_ENABLED === "true" && <RecuperarResolucao userId={userId}/>}
    <RetificacaoTriagem userId={userId} clientes={clientesCarregados} clientesDisponiveis={!clientes.isPending && !clientes.isFetching && !clientes.isError && consistentes}/>
    {(clientes.isPending || eventos.isPending) && <output>Carregando triagem…</output>}{(clientes.isError || eventos.isError) && <p role="alert">Não foi possível carregar triagem. <button type="button" onClick={()=>{if(clientes.isError)void clientes.refetch();if(eventos.isError)void eventos.refetch();}}>Tentar novamente</button></p>}
    {!eventos.isError && eventos.data?.pages.flat().length===0 && <p>Nenhum envelope pendente nesta fonte.</p>}
    {clientes.hasNextPage && <button type="button" disabled={clientes.isFetchingNextPage} onClick={()=>void clientes.fetchNextPage()}>Mais Clientes</button>}
    {!consistentes && <p role="alert">Páginas de Clientes ou envelopes divergentes. <button type="button" onClick={()=>{void clientes.refetch();void eventos.refetch();}}>Reconsultar</button></p>}
    {eventos.data && <div hidden={clientes.isFetching || eventos.isFetching || clientes.isError || eventos.isError || !consistentes}>{eventosCarregados.map((e)=><Indicar key={e.id} userId={userId} evento={e} clientes={clientesCarregados} disponivel={!clientes.isFetching && !eventos.isFetching && !clientes.isError && !eventos.isError && consistentes}/>)}</div>}
    {eventos.hasNextPage && <button type="button" disabled={eventos.isFetchingNextPage} onClick={()=>void eventos.fetchNextPage()}>Mais envelopes</button>}
  </section>;
}
const resolucaoSchema=z.object({requestId:z.string().guid(),envelopeId:z.string().guid(),revision:z.number().int().positive(),osId:z.string().guid(),motivo:z.string().min(1).max(2000)}).strict();
function RecuperarResolucao({userId}:{userId:string}){
  const [aviso,setAviso]=useState("");const [,atualizar]=useState(0);const client=useQueryClient();
  const itens:{chave:string;pedido:z.infer<typeof resolucaoSchema>}[]=[];let erroLocal=false;
  try{for(let i=0;i<sessionStorage.length;i++){const chave=sessionStorage.key(i);if(!chave || !chave.startsWith("sso-resolucao-origem:"))continue;
    let contexto:unknown;try{contexto=JSON.parse(chave.slice("sso-resolucao-origem:".length));}catch{continue;}
    if(!Array.isArray(contexto) || contexto[0]!==userId)continue;
    try{const pedido=resolucaoSchema.parse(JSON.parse(sessionStorage.getItem(chave) ?? ""));if(pedido.envelopeId!==contexto[1])throw new Error("Envelope divergente");itens.push({chave,pedido});}catch{erroLocal=true;}
  }}catch{erroLocal=true;}
  const consulta=useMutation({mutationFn:async(t:typeof itens[number])=>{await conferirSessao(userId);if(sessionStorage.getItem(t.chave)!==JSON.stringify(t.pedido))throw new Error("Tentativa divergente");const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_resolucao_campo_mediada",{p_request_id:t.pedido.requestId});if(error)throw error;
    const r=z.object({envelopeId:z.string().guid(),clienteId:z.string().guid(),osId:z.string().guid(),resolucaoId:z.string().guid(),requestId:z.string().guid(),eventoAplicado:z.literal(false)}).strict().parse(data);
    if(r.envelopeId!==t.pedido.envelopeId || r.osId!==t.pedido.osId || r.requestId!==t.pedido.requestId)throw new Error("Resposta divergente");await conferirSessao(userId);return t;
  },onSuccess:async(t)=>{try{await client.invalidateQueries({queryKey:["triagem-origem",userId,"indicadas"],refetchType:"none"});await conferirSessao(userId);if(sessionStorage.getItem(t.chave)!==JSON.stringify(t.pedido))throw new Error("Tentativa divergente");sessionStorage.removeItem(t.chave);}catch{setAviso("Confirmação encontrada, mas tentativa não foi limpa. Consulte suporte.");return;}atualizar((x)=>x+1);setAviso("Resolução confirmada; evento não aplicado.");void client.refetchQueries({queryKey:["triagem-origem",userId,"indicadas"],type:"active"});},onError:()=>setAviso("Confirmação indisponível ou sem acesso. Consulte suporte antes de nova resolução.")});
  return <section aria-label="Recuperar resolução de origem">{erroLocal && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{itens.map((t)=><p key={t.pedido.requestId}>Resolução pendente {t.pedido.requestId} <button type="button" disabled={consulta.isPending} onClick={()=>consulta.mutate(t)}>Consultar confirmação</button></p>)}{aviso && <p role="status">{aviso}</p>}</section>;
}
function RecuperarTentativas({userId}:{userId:string}){
  const [aviso,setAviso]=useState("");const [,setContador]=useState(0);const client=useQueryClient();
  let tentativas:{chave:string;pedido:Pedido}[]=[];let ilegivel=false;
  try{for(let i=0;i<sessionStorage.length;i++){const chave=sessionStorage.key(i);if(!chave || !chave.startsWith("sso-triagem-origem:"))continue;
    let contexto:unknown;try{contexto=JSON.parse(chave.slice("sso-triagem-origem:".length));}catch{continue;}
    if(!Array.isArray(contexto) || contexto[0]!==userId)continue;
    try{const pedido=pedidoSchema.parse(JSON.parse(sessionStorage.getItem(chave) ?? ""));if(pedido.envelopeId!==contexto[1])throw new Error("Envelope divergente");tentativas.push({chave,pedido});}catch{ilegivel=true;}
  }}catch{ilegivel=true;}
  const consulta=useMutation({mutationFn:async(t:{chave:string;pedido:Pedido})=>{await conferirSessao(userId);if(sessionStorage.getItem(t.chave)!==JSON.stringify(t.pedido))throw new Error("Tentativa divergente");const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_tentativa_triagem_mediada",{p_request_id:t.pedido.requestId});if(error)throw error;
    const r=z.object({envelopeId:z.string().guid(),clienteId:z.string().guid(),revision:z.number().int().positive(),requestId:z.string().guid(),eventoAplicado:z.literal(false)}).strict().parse(data);
    if(r.envelopeId!==t.pedido.envelopeId || r.clienteId!==t.pedido.clienteId || r.requestId!==t.pedido.requestId)throw new Error("Resposta divergente");await conferirSessao(userId);return t;
  },onSuccess:async(t)=>{try{await client.invalidateQueries({queryKey:["triagem-origem",userId,"eventos"],refetchType:"none"});await conferirSessao(userId);if(sessionStorage.getItem(t.chave)!==JSON.stringify(t.pedido))throw new Error("Tentativa divergente");sessionStorage.removeItem(t.chave);}catch{setAviso("Confirmação encontrada, mas sessão não pôde ser limpa. Consulte suporte.");return;}setContador((valor)=>valor+1);setAviso("Indicação confirmada; evento não aplicado.");void client.refetchQueries({queryKey:["triagem-origem",userId,"eventos"],type:"active"});},onError:()=>setAviso("Confirmação indisponível ou sem acesso. Não inicie outra indicação sem consultar suporte.")});
  return <section aria-label="Recuperar tentativas de triagem">{ilegivel && <p role="alert">Há tentativa local ilegível. Consulte suporte.</p>}{tentativas.map((t)=><p key={t.pedido.requestId}>Tentativa pendente {t.pedido.requestId} <button type="button" disabled={consulta.isPending} onClick={()=>consulta.mutate(t)}>Consultar confirmação</button></p>)}{aviso && <p role="status">{aviso}</p>}</section>;
}
function Indicar({userId,evento,clientes,disponivel}:{userId:string;evento:z.infer<typeof itemSchema>;clientes:{id:string;nome:string}[];disponivel:boolean}){
  const storageKey=`sso-triagem-origem:${JSON.stringify([userId,evento.id])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(storageKey);if(!v)return null;const p=pedidoSchema.parse(JSON.parse(v));return p.envelopeId===evento.id ? p : "invalido";}catch{return "invalido";}});
  const [clienteId,setClienteId]=useState("");const [motivo,setMotivo]=useState("");const [confirmacao,setConfirmacao]=useState<string|null>(null);const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const fotografia=JSON.stringify([userId,evento,clientes.find((c)=>c.id===clienteId)??null,motivo.trim()]);const confirmado=confirmacao===fotografia;
  const envio=useMutation({mutationFn:async(p:Pedido)=>{await conferirSessao(userId);if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente");const {data,error}=await supabase.schema("pcm").rpc("sso_indicar_cliente_campo_mediada",{p_request_id:p.requestId,p_envelope_id:p.envelopeId,p_cliente_id:p.clienteId,p_motivo:p.motivo});if(error)throw error;
    const r=z.object({envelopeId:z.string().guid(),clienteId:z.string().guid(),requestId:z.string().guid(),eventoAplicado:z.literal(false)}).strict().parse(data);
    if(r.envelopeId!==p.envelopeId || r.clienteId!==p.clienteId || r.requestId!==p.requestId)throw new Error("Resposta divergente");await conferirSessao(userId);
  },onSuccess:async(_r,p)=>{try{await client.invalidateQueries({queryKey:["triagem-origem",userId,"eventos"],refetchType:"none"});await conferirSessao(userId);if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(storageKey);}catch{setAviso("Não foi possível concluir a conferência da sessão ou tentativa. Consulte o recibo.");return;}setPendente(null);setConfirmacao(null);setAviso("Cliente indicado; evento não foi aplicado.");await client.refetchQueries({queryKey:["triagem-origem",userId,"eventos"],type:"active"});},onError:()=>setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current || !disponivel)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(!disponivel || !confirmado || pendente || trava.current || !clientes.some((c)=>c.id===clienteId))return;try{const p=pedidoSchema.parse({requestId:crypto.randomUUID(),envelopeId:evento.id,clienteId,motivo:motivo.trim()});if(sessionStorage.getItem(storageKey)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(storageKey,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira Cliente, motivo e sessão. Nada foi enviado.");}}
  return <article><p>{evento.integracao} · tarefa {String(evento.task_id)} · Cliente externo {evento.cliente_externo_id ?? "não informado"} · recebido {new Date(evento.recebido_em).toLocaleString("pt-BR")}</p>
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
    {pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending || !disponivel} onClick={()=>enviar(pendente)}>Repetir indicação</button> : !pendente && <form onSubmit={(e)=>{e.preventDefault();iniciar();}}>
      <label>Cliente indicado <select required value={clienteId} onChange={(e)=>setClienteId(e.target.value)}><option value="">Selecione</option>{clientes.map((c)=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
      <label>Motivo <textarea required maxLength={2000} value={motivo} onChange={(e)=>setMotivo(e.target.value)}/></label><label><input type="checkbox" checked={confirmado} onChange={(e)=>setConfirmacao(e.target.checked?fotografia:null)}/> Conferi envelope, Cliente e motivo. A indicação não aplica o evento.</label><button type="submit" disabled={!confirmado || envio.isPending || !disponivel}>Registrar indicação</button>
    </form>}{aviso && <p role="status">{aviso}</p>}
  </article>;
}
