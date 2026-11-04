import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { useState } from "react";
import { DiagnosticoHierarquia } from "./DiagnosticoHierarquia";

const linhaSchema=z.object({chave:z.string(),tipo:z.string(),problemas:z.array(z.string()),possiveis_duplicatas:z.number().int().nonnegative(),classificacao:z.enum(["rejeitada","decidida","atualizada","conferencia_necessaria","possivel_alteracao","possivel_nova"])}).strict();
const rotulos={rejeitada:"Rejeitada",decidida:"Decidida",atualizada:"Cadastro atualizado",conferencia_necessaria:"Conferência necessária",possivel_alteracao:"Possível alteração",possivel_nova:"Possível nova"} as const;
export function DiagnosticoLote(props:{userId:string;clienteId:string;loteId:string;revisao:number;onRevisar?:(chave:string)=>void}){
  if(import.meta.env.VITE_SSO_DIAGNOSTICO_LEVANTAMENTO_ENABLED!=="true")return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.loteId])} {...props}/>;
}
function Conteudo({userId,clienteId,loteId,revisao,onRevisar}:{userId:string;clienteId:string;loteId:string;revisao:number;onRevisar?:(chave:string)=>void}){
  const [filtro,setFiltro]=useState<"todas" | keyof typeof rotulos>("todas");
  const [hierarquiaAberta,setHierarquiaAberta]=useState(false);
  const revisada=import.meta.env.VITE_SSO_DIAGNOSTICO_LOTE_REVISAO_ENABLED==="true";
  const permissao=useQuery({queryKey:["levantamentos",userId,clienteId,"incorporacao-permissao"],queryFn:async({signal})=>{
    const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");
    const resultado=await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar",clienteId);
    const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");return resultado;
  },gcTime:0,refetchOnWindowFocus:true});
  const permitido=permissao.data===true && !permissao.isFetching && !permissao.isError;
  const consulta=useInfiniteQuery({queryKey:["levantamentos",userId,clienteId,loteId,"diagnostico",revisao,revisada],enabled:permitido,gcTime:0,initialPageParam:null as string | null,
    queryFn:async({pageParam,signal})=>{const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");
      const {data,error}=await supabase.schema("pcm").rpc(revisada?"sso_classificacao_linhas_revisada":"sso_classificacao_linhas_autorizada",revisada?{p_ator_id:userId,p_cliente_id:clienteId,p_lote_id:loteId,p_revision:revisao,p_apos:pageParam,p_limite:20}:{p_lote_id:loteId,p_apos:pageParam,p_limite:20}).abortSignal(signal);if(error)throw error;
      const pagina=revisada?z.array(linhaSchema.extend({revisao:z.number().int().positive()}).strict()).max(20).parse(data).map(({revisao:r,...item})=>{if(r!==revisao)throw new Error("Revisão divergente.");return item;}):z.array(linhaSchema).max(20).parse(data);
      if(new Set(pagina.map(item=>item.chave)).size!==pagina.length || (pageParam!==null && pagina.some(item=>item.chave===pageParam)))throw new Error("Página divergente.");
      const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==userId || signal.aborted)throw new Error("Sessão alterada.");return pagina;},
    getNextPageParam:(pagina)=>pagina.length===20 ? pagina.at(-1)?.chave : undefined});
  if(permissao.isPending || permissao.isFetching)return <output>Verificando permissão de diagnóstico…</output>;
  if(permissao.isError)return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={()=>void permissao.refetch()}>Tentar novamente</button></p>;
  if(!permitido)return null;
  const linhas=consulta.data?.pages.flat() ?? [];
  const paginasDivergentes=new Set(linhas.map((linha)=>linha.chave)).size!==linhas.length;
  const contagens=linhas.reduce((resultado, linha)=>{resultado[linha.classificacao]++;return resultado;},
    {rejeitada:0,decidida:0,atualizada:0,conferencia_necessaria:0,possivel_alteracao:0,possivel_nova:0});
  const visiveis=filtro==="todas" ? linhas : linhas.filter((linha)=>linha.classificacao===filtro);
  return <section aria-label="Diagnóstico do lote"><h3>Conferência inicial</h3><p>Verificações literais por Cliente e referências do lote. Ausência de alerta não comprova que a linha está correta; aprovação requer revisão completa. {!revisada && "A revisão do lote não é confirmada nesta consulta."}</p>
    {import.meta.env.VITE_SSO_DIAGNOSTICO_HIERARQUIA_ENABLED === "true" && <><button type="button" aria-expanded={hierarquiaAberta} onClick={()=>setHierarquiaAberta(!hierarquiaAberta)}>{hierarquiaAberta?"Fechar hierarquia":"Consultar hierarquia do lote"}</button>{hierarquiaAberta && <DiagnosticoHierarquia key={`${userId}:${clienteId}:${loteId}:${revisao}`} userId={userId} clienteId={clienteId} loteId={loteId} revisao={revisao} onRevisar={onRevisar}/>}</>}
    {consulta.isFetching && <output>Carregando diagnóstico…</output>}
    {consulta.isError && <p role="alert">Não foi possível consultar diagnóstico. <button type="button" onClick={()=>void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && paginasDivergentes && <p role="alert">O diagnóstico contém linhas repetidas entre páginas. <button type="button" onClick={()=>void consulta.refetch()}>Atualizar diagnóstico</button></p>}
    {consulta.data && !consulta.isFetching && !consulta.isError && !paginasDivergentes && <><p>Resumo das páginas carregadas{consulta.hasNextPage ? " (incompleto; carregue as demais páginas)" : " (sem garantia de fotografia única)"}:</p>
      <dl>{Object.entries(rotulos).map(([valor,rotulo])=><div key={valor}><dt>{rotulo}</dt><dd>{contagens[valor as keyof typeof rotulos]}</dd></div>)}</dl>
      <label>Filtrar classificação <select value={filtro} onChange={(evento)=>setFiltro(evento.target.value as typeof filtro)}><option value="todas">Todas</option>{Object.entries(rotulos).map(([valor,rotulo])=><option key={valor} value={valor}>{rotulo}</option>)}</select></label>
      <p>{visiveis.length} linha(s) nas páginas carregadas{consulta.hasNextPage ? "; há mais páginas para consultar" : ""}.</p>
      {linhas.length===0 ? <p>Nenhuma linha disponível.</p> : visiveis.length===0 ? <p>Nenhuma linha carregada corresponde ao filtro.</p> : <ul>{visiveis.map((l)=><li key={l.chave}>{l.chave} · {l.tipo} · {rotulos[l.classificacao]}: {l.problemas.length ? l.problemas.join(", ") : "sem alerta nesta consulta"}; {l.possiveis_duplicatas} possível(is) duplicata(s) por nome {onRevisar && <button type="button" onClick={()=>onRevisar(l.chave)}>Revisar linha {l.chave}</button>}</li>)}</ul>}</>}
    {consulta.hasNextPage && !paginasDivergentes && <button type="button" disabled={consulta.isFetchingNextPage} onClick={()=>void consulta.fetchNextPage()}>Mais linhas do diagnóstico</button>}
  </section>;
}
