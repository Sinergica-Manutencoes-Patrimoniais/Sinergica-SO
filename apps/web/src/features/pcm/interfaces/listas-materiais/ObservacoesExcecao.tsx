import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const schema=z.object({requestId:z.string().guid(),listaId:z.string().guid(),revision:z.number().int().positive(),eventoRevision:z.number().int().positive(),texto:z.string().min(1).max(2000)}).strict();type Pedido=z.infer<typeof schema>;
type Props={usuario:string;cliente:string;ordemServico:string;listaId:string;revisao:number;eventoRevision:number};
export function ObservacoesExcecao(props:Props){if(import.meta.env.VITE_SSO_OBSERVACOES_MATERIAIS_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([props.usuario,props.cliente,props.listaId,props.eventoRevision])} {...props}/>;}
function Conteudo({usuario,cliente,ordemServico,listaId,revisao,eventoRevision}:Props){
  const chave=`sso-observacao-material:${JSON.stringify([usuario,cliente,listaId,eventoRevision])}`;
  const [pendente,setPendente]=useState<Pedido | "invalido" | null>(()=>{try{const v=sessionStorage.getItem(chave);if(!v)return null;const p=schema.parse(JSON.parse(v));return p.listaId===listaId && p.eventoRevision===eventoRevision ? p : "invalido";}catch{return "invalido";}});
  const [texto,setTexto]=useState("");const [aviso,setAviso]=useState("");const trava=useRef(false);const client=useQueryClient();
  const lista=useInfiniteQuery({queryKey:["listas-materiais",usuario,cliente,ordemServico,"observacoes",listaId,eventoRevision],gcTime:0,initialPageParam:null as number | null,
    queryFn:async({pageParam,signal})=>{const {data,error}=await supabase.schema("pcm").rpc("sso_listar_observacoes_excecao_material",{p_lista_id:listaId,p_evento_revision:eventoRevision,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;return z.array(z.object({lista_revision:z.number().int().positive(),texto:z.string(),ator_id:z.string().guid(),criado_em:z.string().datetime({offset:true})}).strict()).max(20).parse(data);},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.lista_revision : undefined});
  const envio=useMutation({mutationFn:async(p:Pedido)=>{const {data,error}=await supabase.schema("pcm").rpc("sso_anotar_excecao_material",{p_request_id:p.requestId,p_lista_id:p.listaId,p_expected_revision:p.revision,p_evento_revision:p.eventoRevision,p_texto:p.texto});if(error)throw error;
    const r=z.object({listaId:z.string().guid(),eventoRevision:z.number().int(),revision:z.number().int(),requestId:z.string().guid()}).strict().parse(data);if(r.listaId!==p.listaId || r.eventoRevision!==p.eventoRevision || r.revision!==p.revision+1 || r.requestId!==p.requestId)throw new Error("Resposta divergente");
  },onSuccess:async(_r,p)=>{try{if(sessionStorage.getItem(chave)!==JSON.stringify(p))throw new Error("Tentativa divergente");sessionStorage.removeItem(chave);}catch{setAviso("Observação registrada; tentativa local não foi limpa. Consulte suporte.");return;}setPendente(null);setTexto("");setAviso("Observação registrada; não indica resolução.");await client.invalidateQueries({queryKey:["listas-materiais",usuario,cliente,ordemServico]});},onError:()=>setAviso("Resultado não confirmado. Repita a tentativa ou consulte suporte."),onSettled:()=>{trava.current=false;}});
  function enviar(p:Pedido){if(trava.current)return;trava.current=true;envio.mutate(p);}
  function iniciar(){if(pendente || trava.current)return;try{const p=schema.parse({requestId:crypto.randomUUID(),listaId,revision:revisao,eventoRevision,texto:texto.trim()});if(sessionStorage.getItem(chave)!==null)throw new Error("Tentativa existente");sessionStorage.setItem(chave,JSON.stringify(p));setPendente(p);enviar(p);}catch{setAviso("Confira o texto e a sessão. Nada foi enviado.");}}
  return <section><h4>Observações</h4><p>Observações não resolvem nem fecham a exceção.</p>
    {lista.isPending && <output>Carregando observações…</output>}{lista.isError && <p role="alert">Não foi possível consultar observações. <button type="button" onClick={()=>void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isError && <ul>{lista.data?.pages.flat().map((i)=><li key={i.lista_revision}>{new Date(i.criado_em).toLocaleString("pt-BR")} · {i.ator_id}: {i.texto}</li>)}</ul>}
    {lista.hasNextPage && <button type="button" disabled={lista.isFetchingNextPage} onClick={()=>void lista.fetchNextPage()}>Mais observações</button>}
    {pendente==="invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{pendente && pendente!=="invalido" ? <button type="button" disabled={envio.isPending} onClick={()=>enviar(pendente)}>Repetir tentativa</button> : !pendente && <form onSubmit={(e)=>{e.preventDefault();iniciar();}}><label>Observação <textarea required maxLength={2000} value={texto} onChange={(e)=>setTexto(e.target.value)}/></label><button type="submit" disabled={envio.isPending}>Registrar observação</button></form>}{aviso && <p role="status">{aviso}</p>}
  </section>;
}
