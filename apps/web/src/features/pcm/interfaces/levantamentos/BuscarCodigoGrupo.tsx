import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const linha=z.object({lote_id:z.string().guid(),linha_chave:z.string(),nome:z.string().nullable(),estado:z.enum(["incorporada","rejeitada","pendente"])}).strict();
export function BuscarCodigoGrupo({userId,clienteId}:{userId:string;clienteId:string}){
  const ativo=import.meta.env.VITE_SSO_BUSCAR_CODIGO_GRUPO_STAGING_ENABLED==="true";const [entrada,setEntrada]=useState("");const [codigo,setCodigo]=useState("");
  const q=useInfiniteQuery({queryKey:["levantamentos",userId,clienteId,"codigo-grupo",codigo],enabled:ativo && codigo.length>0,gcTime:0,initialPageParam:null as {lote:string;chave:string}|null,queryFn:async({pageParam,signal})=>{
    const {data,error}=await supabase.schema("pcm").rpc("sso_buscar_codigo_grupo_staging",{p_cliente_id:clienteId,p_codigo:codigo,p_apos_lote:pageParam?.lote ?? null,p_apos_chave:pageParam?.chave ?? null,p_limite:20}).abortSignal(signal);if(error)throw error;return z.array(linha).max(20).parse(data);
  },getNextPageParam:p=>{const ultima=p.length===20 ? p[p.length - 1] : undefined;return ultima ? {lote:ultima.lote_id,chave:ultima.linha_chave} : undefined;}});
  if(!ativo)return null;
  return <section aria-label="Buscar código declarado de Grupo"><h3>Buscar código informado de Grupo</h3><p>Busca exata nos levantamentos; resultado é declaração, não código oficial ou alias confirmado.</p><form onSubmit={e=>{e.preventDefault();setCodigo(entrada);}}><label>Código informado <input required maxLength={200} value={entrada} onChange={e=>setEntrada(e.target.value)}/></label><button type="submit">Buscar</button></form>
    {codigo && q.isPending && <output>Buscando…</output>}{q.isError && <p role="alert">Busca indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}{q.data && <><ul>{q.data.pages.flat().map(l=><li key={JSON.stringify([l.lote_id,l.linha_chave])}>{l.nome ?? "Nome não informado"} · lote {l.lote_id} · linha {l.linha_chave} · {l.estado}</li>)}</ul>{q.data.pages.flat().length===0 && <p>Nenhuma linha encontrada.</p>}</>}{q.hasNextPage && <button type="button" disabled={q.isFetching} onClick={()=>void q.fetchNextPage()}>Carregar mais</button>}
  </section>;
}
