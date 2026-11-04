import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { InterrupcoesParcela } from "./InterrupcoesParcela";
import { AtribuirParcela } from "./AtribuirParcela";
import { RevisaoParcela } from "./RevisaoParcela";
import { AtenderParcelaRevisada } from "./AtenderParcelaRevisada";
import { ReconciliacaoParcela } from "./ReconciliacaoParcela";
import { GutdParcela } from "./GutdParcela";
import { DiagnosticoDevolucao } from "./DiagnosticoDevolucao";
const schema=z.object({pendencia_id:z.string().uuid(),parcela_id:z.string().uuid(),descricao:z.string(),situacao:z.string(),os_atendimento_id:z.string().uuid().nullable(),ordens_nao_finalizadas:z.number().int().nonnegative(),elegibilidade:z.literal("nao_comprovada"),motivos:z.array(z.string())}).strict();
export function PreviaDevolucao(props:{userId:string;clienteId:string;composicaoId:string}){if(import.meta.env.VITE_SSO_PREVIA_DEVOLUCAO_ENABLED!=="true")return null;return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.composicaoId])} {...props}/>;}
function Conteudo({userId,clienteId,composicaoId}:{userId:string;clienteId:string;composicaoId:string}){
  const consulta=useInfiniteQuery({queryKey:["backlog-vinculo",userId,clienteId,composicaoId,"previa-devolucao"],gcTime:0,initialPageParam:null as string | null,queryFn:async({pageParam,signal})=>{
    const {data,error}=await supabase.schema("pcm").rpc("sso_prever_devolucao_backlog",{p_composicao_id:composicaoId,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;const pagina=z.array(schema).max(20).parse(data);
    let anterior=pageParam?.toLowerCase() ?? null;const parcelas=new Set<string>();
    for(const linha of pagina){const atual=linha.pendencia_id.toLowerCase();const parcela=linha.parcela_id.toLowerCase();if((anterior!==null && atual<=anterior)||parcelas.has(parcela))throw new Error("Página de parcelas divergente.");anterior=atual;parcelas.add(parcela);}
    return pagina;},getNextPageParam:(p)=>p.length===20 ? p.at(-1)?.pendencia_id : undefined});
  return <section><h4>Prévia de devolução</h4><p>Nenhuma parcela é liberada por esta consulta. A suspensão e o trabalho em cada parcela ainda precisam de prova.</p>
    {import.meta.env.VITE_SSO_DIAGNOSTICO_DEVOLUCAO_ENABLED === "true" && <DiagnosticoDevolucao userId={userId} clienteId={clienteId} composicaoId={composicaoId}/>}
    {consulta.isPending && <output>Consultando diagnóstico…</output>}{consulta.isError && <p role="alert">Não foi possível consultar diagnóstico. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length===0 && <p>Nenhuma parcela vinculada nesta composição.</p>}
    {!consulta.isFetching && !consulta.isError && <ul>{consulta.data?.pages.flat().map((p)=><li key={p.pendencia_id}>{p.descricao} · estado {p.situacao} · elegibilidade não comprovada · {p.ordens_nao_finalizadas} OS não finalizada(s) no Chamado · {p.motivos.join(", ")}<GutdParcela userId={userId} clienteId={clienteId} parcelaId={p.parcela_id}/><AtribuirParcela userId={userId} clienteId={clienteId} parcelaId={p.parcela_id}/><RevisaoParcela userId={userId} clienteId={clienteId} parcelaId={p.parcela_id}/><AtenderParcelaRevisada userId={userId} clienteId={clienteId} parcelaId={p.parcela_id}/><ReconciliacaoParcela userId={userId} clienteId={clienteId} parcelaId={p.parcela_id}/>{import.meta.env.VITE_SSO_INTERRUPCAO_PARCELA_ENABLED === "true" && <InterrupcoesParcela userId={userId} clienteId={clienteId} parcelaId={p.parcela_id}/>}</li>)}</ul>}
    {consulta.hasNextPage && <button type="button" disabled={consulta.isFetchingNextPage} onClick={()=>void consulta.fetchNextPage()}>Mais parcelas</button>}
  </section>;
}
