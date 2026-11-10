import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { HistoricoMateriais } from "./HistoricoMateriais";
import { conferirSessaoMateriais } from "../infrastructure/supabase-portal-materiais-adapter";

export function ListasHistoricoMateriais(props: { userId: string; clienteId: string; osId: string }) {
  if (import.meta.env.VITE_SSO_HISTORICO_MATERIAIS_RETIRADOS_ENABLED !== "true" || import.meta.env.VITE_SSO_HISTORICO_MATERIAIS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const listas = useInfiniteQuery({ queryKey: ["portal-listas-historico-materiais", userId, clienteId, osId], gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessaoMateriais(userId, signal);const parametros={p_cliente_id:clienteId,p_os_id:osId,p_apos:pageParam};
      const requisicao=import.meta.env.VITE_SSO_HISTORICO_MATERIAIS_MEDIADO_ENABLED==="true"?supabase.schema("pcm").rpc("sso_portal_listas_historico_materiais_mediado",{...parametros,p_ator_id:userId}):supabase.schema("pcm").rpc("sso_portal_listas_historico_materiais",parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error; const pagina = z.array(z.object({ lista_id: z.string().guid() }).strict()).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null; for (const item of pagina) { const id = item.lista_id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página divergente."); anterior = id; } await conferirSessaoMateriais(userId, signal); return pagina; },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.lista_id : undefined });
  return <section aria-label="Histórico anterior de materiais"><h4>Histórico anterior de materiais</h4>
    <p>Inclui apenas listas com versões anteriores publicadas que ainda estejam disponíveis.</p>
    {listas.isFetching && <p>Consultando histórico…</p>}{listas.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void listas.refetch()}>Tentar novamente</button></p>}
    {!listas.isFetching && !listas.isError && listas.data?.pages.flat().length === 0 && <p>Nenhum histórico anterior disponível.</p>}
    {!listas.isFetching && !listas.isError && listas.data?.pages.flat().map((l) => <div key={l.lista_id}>
      <p>Lista {l.lista_id}</p><HistoricoMateriais userId={userId} clienteId={clienteId} osId={osId} listaId={l.lista_id} />
    </div>)}
    {!listas.isError && listas.hasNextPage && <button type="button" disabled={listas.isFetching} onClick={() => {if(!listas.isFetching)void listas.fetchNextPage();}}>Mais listas</button>}
  </section>;
}
