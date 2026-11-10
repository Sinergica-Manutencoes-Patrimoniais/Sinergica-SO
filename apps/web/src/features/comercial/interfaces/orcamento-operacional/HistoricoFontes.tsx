import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const fonte = z.object({ despesaId: z.string().guid(), despesaRevision: z.number().int().positive(), rateioRevision: z.number().int().positive(), vinculoId: z.string().guid(), grupo: z.enum(["aquisicao","operacional"]), valorCentavos: z.number().int().safe().nonnegative(), base: z.enum(["previsto","realizado"]), descricaoFonte: z.string().min(1).max(10000) }).strict();
const linha = z.object({ posicao: z.number().int().positive(), fonte }).strict();
type Props = { usuario: string; cliente: string; propostaId: string; versao: number };
export function HistoricoFontes(props: Props) {
  const [aberto,setAberto] = useState(false);
  if (import.meta.env.VITE_SSO_HISTORICO_FONTES_ORCAMENTO_ENABLED !== "true") return null;
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(v=>!v)}>{aberto ? "Ocultar fontes da versão" : "Consultar fontes da versão"}</button>{aberto && <Conteudo key={JSON.stringify([props.usuario,props.cliente,props.propostaId,props.versao])} {...props} />}</section>;
}
function Conteudo({usuario,cliente,propostaId,versao}:Props) {
  const q=useInfiniteQuery({queryKey:["orcamento-fontes-historico",usuario,cliente,propostaId,versao],gcTime:0,initialPageParam:0,queryFn:async ({pageParam,signal})=>{
    const antes=await supabase.auth.getUser();if(antes.error || antes.data.user?.id!==usuario || signal.aborted)throw new Error("Sessão alterada.");
    const {data,error}=await supabase.schema("comercial").rpc("sso_listar_fontes_orcamento",{p_ator_id:usuario,p_cliente_id:cliente,p_proposta_id:propostaId,p_versao:versao,p_apos:pageParam,p_limite:20}).abortSignal(signal);
    if(error)throw error;const pagina=z.array(linha).max(20).parse(data);let posicao=pageParam;
    for(const item of pagina){if(item.posicao!==posicao+1)throw new Error("Página inconsistente.");posicao=item.posicao;}
    const depois=await supabase.auth.getUser();if(depois.error || depois.data.user?.id!==usuario || signal.aborted)throw new Error("Sessão alterada.");return pagina;
  },getNextPageParam:p=>p.length===20 ? p[p.length-1]?.posicao : undefined});
  return <div><h4>Fontes privadas da versão {versao}</h4><p>Fotografia da composição, não necessariamente a situação atual das despesas. Não enviar ao Cliente.</p>
    {q.isFetching && <output>Consultando fontes…</output>}{q.isError && <p role="alert">Fotografia indisponível. <button type="button" onClick={()=>void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching && !q.isError && q.data && <>{q.data.pages.flat().length===0 ? <p>Nenhuma fonte nesta fotografia.</p> : <ul>{q.data.pages.flat().map(item=><li key={item.posicao}>{item.fonte.descricaoFonte} · {item.fonte.valorCentavos} centavos · {item.fonte.grupo} · {item.fonte.base} · despesa {item.fonte.despesaId}</li>)}</ul>}{q.hasNextPage && <button type="button" onClick={()=>void q.fetchNextPage()}>Mais fontes</button>}</>}
  </div>;
}
