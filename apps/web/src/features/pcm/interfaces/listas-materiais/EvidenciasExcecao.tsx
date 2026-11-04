import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema=z.object({requestId:z.string().uuid(),cliente:z.string().uuid(),listaId:z.string().uuid(),revision:z.number().int().positive(),nome:z.string(),hash:z.string().regex(/^[a-f0-9]{64}$/),tipo:z.enum(["image/jpeg","image/png"])}).strict();
type Pedido=z.infer<typeof pedidoSchema>;
type Props={usuario:string;cliente:string;listaId:string;revision:number};
async function sessao(usuario:string,signal?:AbortSignal){const r=await supabase.auth.getUser();if(r.error||r.data.user?.id!==usuario||signal?.aborted)throw new Error("Sessão alterada.");}
export function EvidenciasExcecao(props:Props){if(import.meta.env.VITE_SSO_EVIDENCIAS_MATERIAIS_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([props.usuario,props.cliente,props.listaId,props.revision])} {...props}/>;}
function Conteudo({usuario,cliente,listaId,revision}:Props){
  const storageKey=`sso-evidencia-material:${JSON.stringify([usuario,cliente,listaId,revision])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(storageKey);if(!v)return null;const p=pedidoSchema.parse(JSON.parse(v));return p.cliente===cliente && p.listaId===listaId && p.revision===revision && p.nome.startsWith(`${cliente}/${listaId}/${revision}/`) ? p : "invalido";}catch{return "invalido";}});
  const [arquivo,setArquivo]=useState<File | null>(null);const [aviso,setAviso]=useState("");const [consultando,setConsultando]=useState(false);const trava=useRef(false);const client=useQueryClient();
  const montado=useRef(false);useEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
  const lista=useInfiniteQuery({queryKey:["evidencias-material",usuario,cliente,listaId,revision],gcTime:0,initialPageParam:null as string | null,
    queryFn:async({pageParam,signal})=>{await sessao(usuario,signal);const parametros={p_lista_id:listaId,p_evento_revision:revision,p_apos:pageParam,p_limite:20};const {data,error}=await (import.meta.env.VITE_SSO_EVIDENCIA_MATERIAL_MEDIADA_ENABLED==="true"?supabase.schema("pcm").rpc("sso_listar_evidencias_material_mediada",{...parametros,p_ator_id:usuario,p_cliente_id:cliente}):supabase.schema("pcm").rpc("sso_listar_evidencias_material",parametros)).abortSignal(signal);if(error)throw error;const pagina=z.array(z.object({id:z.string().uuid(),criado_em:z.string().datetime({offset:true})}).strict()).max(20).parse(data);let anterior=pageParam?.toLowerCase()??"";for(const item of pagina){if(item.id.toLowerCase()<=anterior)throw new Error("Página divergente.");anterior=item.id.toLowerCase();}await sessao(usuario,signal);return pagina;},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.id : undefined});
  const envio=useMutation({mutationFn:async({p,arquivo}:{p:Pedido;arquivo:File})=>{
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await arquivo.arrayBuffer())),v=>v.toString(16).padStart(2,"0")).join("");
    if(hash!==p.hash || arquivo.type!==p.tipo || arquivo.size===0 || arquivo.size>10485760)throw new Error("Arquivo divergente");
    await sessao(usuario);if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente.");
    const {error:uploadError}=await supabase.storage.from("sso-material-evidencias").upload(p.nome,arquivo,{contentType:p.tipo,upsert:false});
    await sessao(usuario);if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente.");
    const mediada=import.meta.env.VITE_SSO_INGESTAO_MATERIAL_MEDIADA_ENABLED==="true";
    const {data:objeto,error:resolverError}=await (mediada?supabase.schema("pcm").rpc("sso_resolver_upload_material_mediado",{p_ator_id:usuario,p_cliente_id:cliente,p_lista_id:p.listaId,p_evento_revision:p.revision,p_nome:p.nome}):supabase.schema("pcm").rpc("sso_resolver_upload_evidencia_material",{p_nome:p.nome}));
    if(resolverError || typeof objeto!=="string")throw uploadError ?? resolverError ?? new Error("Upload não confirmado");
    await sessao(usuario);if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente.");
    const parametros={p_request_id:p.requestId,p_lista_id:p.listaId,p_evento_revision:p.revision,p_objeto_id:objeto};
    const {data,error}=await (mediada?supabase.functions.invoke("pcm-evidencia-material-verificar",{body:{requestId:p.requestId,clienteId:p.cliente,listaId:p.listaId,eventoRevision:p.revision,nome:p.nome,objetoId:objeto,digest:p.hash,tipo:p.tipo}}):supabase.schema("pcm").rpc("sso_vincular_evidencia_material",parametros));if(error)throw error;
    const r=z.object({evidenciaId:z.string().uuid(),listaId:z.string().uuid(),eventoRevision:z.number().int(),requestId:z.string().uuid()}).strict().parse(data);
    if(r.listaId!==p.listaId || r.eventoRevision!==p.revision || r.requestId!==p.requestId)throw new Error("Resposta divergente");
  },onSuccess:async(_r,{p})=>{try{await sessao(usuario);if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente");await client.invalidateQueries({queryKey:["evidencias-material",usuario,cliente,listaId,revision]});await sessao(usuario);if(sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(storageKey);}catch{setAviso("Evidência vinculada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setArquivo(null);setAviso("Evidência vinculada.");},
  onError:()=>setAviso("Resultado não confirmado. Selecione o mesmo arquivo e repita ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  async function enviar(){if(!arquivo || trava.current || pendente==="invalido")return;trava.current=true;try{
    if(arquivo.size===0 || arquivo.size>10485760 || !["image/jpeg","image/png"].includes(arquivo.type))throw new Error("Imagem inválida");
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await arquivo.arrayBuffer())),v=>v.toString(16).padStart(2,"0")).join("");
    const p=pendente ?? pedidoSchema.parse({requestId:crypto.randomUUID(),cliente,listaId,revision,nome:`${cliente}/${listaId}/${revision}/${crypto.randomUUID()}`,hash,tipo:arquivo.type});
    if(p.hash!==hash || p.tipo!==arquivo.type)throw new Error("Imagem divergente");
    if(!pendente){if(sessionStorage.getItem(storageKey)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(storageKey,JSON.stringify(p));setPendente(p);}envio.mutate({p,arquivo});
  }catch{trava.current=false;setAviso("Selecione JPEG/PNG de até 10 MiB; para recuperar use exatamente o mesmo arquivo.");}}
  async function consultarRecibo(p:Pedido){if(trava.current)return;trava.current=true;setConsultando(true);setAviso("");try{
    await sessao(usuario);if(!montado.current||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
    const {data,error}=await supabase.schema("pcm").rpc("sso_consultar_recibo_evidencia_material",{p_ator_id:usuario,p_cliente_id:cliente,p_lista_id:listaId,p_evento_revision:revision,p_request_id:p.requestId});if(error)throw error;
    const r=z.discriminatedUnion("estado",[z.object({requestId:z.string().uuid(),estado:z.literal("nao_localizado")}).strict(),z.object({requestId:z.string().uuid(),estado:z.literal("vinculada"),evidenciaId:z.string().uuid(),listaId:z.string().uuid(),eventoRevision:z.number().int().positive()}).strict()]).parse(data);
    if(r.requestId!==p.requestId)throw new Error("Recibo divergente.");await sessao(usuario);if(!montado.current||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
    if(r.estado==="nao_localizado"){setAviso("Recibo ainda não localizado. Isso não confirma falha nem término do envio; preserve a mesma tentativa.");return;}
    if(r.listaId!==listaId||r.eventoRevision!==revision)throw new Error("Recibo divergente.");
    await client.invalidateQueries({queryKey:["evidencias-material",usuario,cliente,listaId,revision]});await sessao(usuario);if(!montado.current||sessionStorage.getItem(storageKey)!==JSON.stringify(p))throw new Error("Tentativa alterada.");
    sessionStorage.removeItem(storageKey);setPendente(null);setArquivo(null);setAviso("Vínculo confirmado pelo recibo. A origem e a integridade do arquivo exigem conferência própria.");
  }catch{if(montado.current)setAviso("Não foi possível consultar o recibo. Preserve a mesma tentativa ou procure suporte.");}finally{trava.current=false;if(montado.current)setConsultando(false);}}
  const evidencias=lista.data?.pages.flat()??[];const divergentes=evidencias.some((e,i)=>i>0&&e.id.toLowerCase()<=evidencias[i-1]!.id.toLowerCase());
  return <section aria-label="Evidências da exceção"><h4>Evidências</h4>
    {lista.isFetching && <output>Carregando evidências…</output>}{lista.isError && <p role="alert">Não foi possível consultar evidências. <button type="button" onClick={()=>void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isFetching && !lista.isError && divergentes && <p role="alert">Páginas de evidências divergentes. <button type="button" onClick={()=>void lista.refetch()}>Reconsultar</button></p>}
    {!lista.isFetching && !lista.isError && !divergentes && lista.data && evidencias.length===0 && <p>Nenhuma evidência vinculada.</p>}
    {!lista.isFetching && !lista.isError && !divergentes && evidencias.map((e)=><Evidencia key={e.id} id={e.id} usuario={usuario}/>)}{!lista.isFetching && !lista.isError && !divergentes && lista.hasNextPage && <button type="button" onClick={()=>void lista.fetchNextPage()}>Mais evidências</button>}
    <label>Imagem JPEG/PNG <input type="file" accept="image/jpeg,image/png" onChange={(e)=>setArquivo(e.target.files?.[0] ?? null)}/></label>
    <button type="button" disabled={!arquivo || envio.isPending || consultando || pendente==="invalido"} onClick={()=>void enviar()}>{pendente ? "Repetir envio" : "Adicionar evidência"}</button>
    {import.meta.env.VITE_SSO_RECIBO_EVIDENCIA_MATERIAL_ENABLED==="true" && pendente && pendente!=="invalido" && <button type="button" disabled={envio.isPending||consultando} onClick={()=>void consultarRecibo(pendente)}>Consultar recibo sem reenviar</button>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
function Evidencia({id,usuario}:{id:string;usuario:string}){const [url,setUrl]=useState<string | null>(null);const [erro,setErro]=useState(false);const [abrindo,setAbrindo]=useState(false);const montado=useRef(false);
  useEffect(()=>{montado.current=true;return()=>{montado.current=false;};},[]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  async function abrir(){setAbrindo(true);setErro(false);try{await sessao(usuario);if(!montado.current)throw new Error("Tela fechada.");const {data,error}=await supabase.functions.invoke("pcm-evidencia-material-segura",{body:{evidenciaId:id}});if(error || !(data instanceof Blob) || !["image/jpeg","image/png"].includes(data.type) || data.size>10485760)throw new Error("Imagem inválida");await sessao(usuario);if(montado.current)setUrl(URL.createObjectURL(data));}catch{if(montado.current)setErro(true);}finally{if(montado.current)setAbrindo(false);}}
  return <div>{url ? <><img src={url} alt="Evidência da exceção de materiais"/><button type="button" onClick={()=>setUrl(null)}>Ocultar evidência</button></> : <button type="button" disabled={abrindo} onClick={()=>void abrir()}>Ver evidência</button>}{erro && <p role="alert">Evidência indisponível ou acesso não autorizado.</p>}</div>;
}
