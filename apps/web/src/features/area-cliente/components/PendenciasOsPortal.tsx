import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const pendencia = z.object({ id: z.string().guid(), alvo: z.string(), descricao: z.string(), estado: z.enum(["aberta", "risco_aceito", "dispensada", "duplicada", "resolvida"]), publicado_em: z.string() }).strict();
const estados: Record<z.infer<typeof pendencia>["estado"], string> = { aberta: "Aberta", risco_aceito: "Risco aceito", dispensada: "Dispensada", duplicada: "Duplicada", resolvida: "Resolvida" };
export function PendenciasOsPortal(props: { userId: string; clienteId: string; osId: string }) {
  if (import.meta.env.VITE_SSO_PORTAL_PENDENCIAS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const lista = useInfiniteQuery({ queryKey: ["portal-pendencias-os", userId, clienteId, osId], gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_portal_pendencias_os_mediada", { p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(pendencia).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? ""; for (const item of pagina) { if (item.id.toLowerCase() <= anterior) throw new Error("Página divergente."); anterior = item.id.toLowerCase(); } const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const itens = lista.data?.pages.flat() ?? []; const consistentes = itens.every((p,i) => i === 0 || itens[i-1]!.id.toLowerCase() < p.id.toLowerCase());
  return <section aria-label="Pendências comunicadas"><h3>Pendências comunicadas</h3>
    <p>Exibe apenas informações publicadas para esta OS; a ausência de itens não comprova inexistência de pendências.</p>
    {lista.isFetching && <p>Consultando pendências…</p>}
    {lista.isError && <p role="alert">Pendências indisponíveis ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {!consistentes && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void lista.refetch()}>Reconsultar</button></p>}
    {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma pendência comunicada.</p>}
    {!lista.isFetching && !lista.isError && consistentes && itens.map((p) => <article key={p.id}>
      <h4>{p.alvo}</h4><p>{p.descricao}</p><p>{estados[p.estado]} · Publicado em {new Date(p.publicado_em).toLocaleString("pt-BR")}</p>
    </article>)}
    {!lista.isError && lista.hasNextPage && <button type="button" disabled={lista.isFetching} onClick={() => void lista.fetchNextPage()}>Mais pendências</button>}
  </section>;
}
