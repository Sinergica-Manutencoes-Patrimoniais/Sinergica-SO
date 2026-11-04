import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { conferirSessaoMateriais } from "../infrastructure/supabase-portal-materiais-adapter";

const linha = z.object({ descricao: z.string(), quantidade: z.string().nullable(), unidade: z.string().nullable() }).strict();
type Props={userId:string;clienteId:string;osId:string;listaId:string};
export function HistoricoMateriais(props:Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_MATERIAIS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId,props.clienteId,props.osId,props.listaId])} {...props}/>;
}
function Conteudo({ userId, clienteId, osId, listaId }: Props) {
  const [aberto, setAberto] = useState(false); const [revisao, setRevisao] = useState<number | null>(null);
  const lista = useInfiniteQuery({ queryKey: ["portal-historico-materiais", userId, clienteId, osId, listaId], enabled: aberto,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => { await conferirSessaoMateriais(userId, signal); const parametros={p_cliente_id:clienteId,p_os_id:osId,p_lista_id:listaId,p_apos:pageParam};
      const requisicao=import.meta.env.VITE_SSO_HISTORICO_MATERIAIS_MEDIADO_ENABLED==="true"?supabase.schema("pcm").rpc("sso_portal_historico_materiais_mediado",{...parametros,p_ator_id:userId}):supabase.schema("pcm").rpc("sso_portal_historico_materiais",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const pagina = z.array(z.object({ revisao_publicacao: z.number().int().positive(), publicado_em: z.string().datetime({offset:true}) }).strict()).max(20).parse(data);
      let anterior = pageParam; for (const item of pagina) { if (item.revisao_publicacao <= anterior) throw new Error("Página divergente."); anterior = item.revisao_publicacao; } await conferirSessaoMateriais(userId, signal); return pagina; },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.revisao_publicacao : undefined });
  const versoes = lista.data?.pages.flat() ?? []; const consistentes = versoes.every((item, i) => i === 0 || versoes[i - 1]!.revisao_publicacao < item.revisao_publicacao);
  const revisaoVisivel = revisao !== null && consistentes && !lista.isFetching && !lista.isError && versoes.some((item) => item.revisao_publicacao === revisao);
  const detalhe = useQuery({ queryKey: ["portal-versao-materiais", userId, clienteId, osId, listaId, revisao], enabled: aberto && revisaoVisivel,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      await conferirSessaoMateriais(userId, signal); const parametros={p_cliente_id:clienteId,p_os_id:osId,p_lista_id:listaId,p_revisao:revisao};
      const requisicao=import.meta.env.VITE_SSO_HISTORICO_MATERIAIS_MEDIADO_ENABLED==="true"?supabase.schema("pcm").rpc("sso_portal_versao_materiais_mediada",{...parametros,p_ator_id:userId}):supabase.schema("pcm").rpc("sso_portal_versao_materiais",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const resultado = z.array(linha).max(100).parse(data); await conferirSessaoMateriais(userId, signal); return resultado;
    } });
  return <section><button type="button" onClick={() => { setAberto((v) => !v); setRevisao(null); }}>{aberto ? "Ocultar versões" : "Ver versões públicas"}</button>
    {aberto && <><p>Somente versões publicadas e não retiradas são exibidas.</p>
      {lista.isFetching && <p>Consultando versões…</p>}{lista.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
      {!consistentes && <p role="alert">Páginas de versões divergentes. <button type="button" onClick={() => void lista.refetch()}>Reconsultar</button></p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma versão disponível.</p>}
      {!lista.isFetching && !lista.isError && consistentes && versoes.map((v) => <p key={v.revisao_publicacao}>Versão {v.revisao_publicacao} · {new Date(v.publicado_em).toLocaleString("pt-BR")} <button type="button" onClick={() => setRevisao(v.revisao_publicacao)}>Consultar</button></p>)}
      {!lista.isError && lista.hasNextPage && <button type="button" disabled={lista.isFetching} onClick={() => {if(!lista.isFetching)void lista.fetchNextPage();}}>Mais versões</button>}
      {revisao !== null && !lista.isFetching && !lista.isError && !revisaoVisivel && <p>Versão indisponível na consulta atual.</p>}
      {revisaoVisivel && detalhe.isFetching && <p>Consultando versão…</p>}{revisaoVisivel && detalhe.isError && <p role="alert">Versão indisponível ou retirada.</p>}
      {revisaoVisivel && !detalhe.isFetching && !detalhe.isError && detalhe.data && <ul>{detalhe.data.map((l, i) => <li key={i}>{l.descricao}{l.quantidade ? ` — ${l.quantidade}` : ""}{l.unidade ? ` ${l.unidade}` : ""}</li>)}</ul>}</>}
  </section>;
}
