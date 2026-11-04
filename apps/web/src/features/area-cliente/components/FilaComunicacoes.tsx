import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { DetalheComunicacao } from "./DetalheComunicacao";

const item = z.object({ id: z.string().uuid(), tipo: z.enum(["visita", "pendencia"]), os_id: z.string().uuid(), publicado_em: z.string(), descricao: z.string() }).strict();
export function FilaComunicacoes({ userId, clienteId }: { userId: string; clienteId: string }) {
  const lista = useInfiniteQuery({ queryKey: ["portal-comunicacoes", userId, clienteId], gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, initialPageParam: null as { data: string; tipo: "visita" | "pendencia"; id: string } | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_portal_comunicacoes", {
      p_cliente_id: clienteId, p_apos_data: pageParam?.data ?? null, p_apos_tipo: pageParam?.tipo ?? null, p_apos_id: pageParam?.id ?? null }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data); }, getNextPageParam: (pagina) => {
        const ultimo = pagina.at(-1); return pagina.length === 20 && ultimo ? { data: ultimo.publicado_em, tipo: ultimo.tipo, id: ultimo.id } : undefined;
      } });
  return <section aria-label="Comunicações públicas"><h2>Comunicações públicas</h2>
    <p>Total e quantidade não lida indisponíveis. Esta lista não envia notificações nem registra leitura; fontes desabilitadas não são incluídas.</p>
    {lista.isFetching && <p>Consultando comunicações…</p>}{lista.isError && <p role="alert">Comunicações indisponíveis ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma comunicação disponível nas fontes consultadas.</p>}
    {!lista.isFetching && !lista.isError && lista.data?.pages.flat().map((i) => <article key={`${i.tipo}:${i.id}`}>
      <p>{i.tipo === "visita" ? "Visita" : "Pendência"} · OS {i.os_id} · {new Date(i.publicado_em).toLocaleString("pt-BR")}</p>
      {import.meta.env.VITE_SSO_DETALHE_COMUNICACAO_ENABLED === "true" ? <DetalheComunicacao userId={userId} clienteId={clienteId} publicacaoId={i.id} tipo={i.tipo} /> : <p>{i.descricao}</p>}
    </article>)}
    {!lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais comunicações</button>}
  </section>;
}
