import { useInfiniteQuery } from "@tanstack/react-query";
import { listarTimelineOs } from "../infrastructure/supabase-portal-timeline-adapter";

type Props = { userId: string; clienteId: string; osId: string };
const STATUS: Record<string, string> = {
  solicitacao: "Solicitação", corretiva: "Corretiva", backlog: "Backlog", planejamento: "Planejamento",
  em_execucao: "Em execução", finalizado: "Finalizado", cancelado: "Cancelado",
};
export function TimelineOsPortal(props: Props) {
  if (import.meta.env.VITE_SSO_PORTAL_TIMELINE_OS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: Props) {
  const consulta = useInfiniteQuery({ queryKey: ["portal-timeline-os", userId, clienteId, osId],
    initialPageParam: null as { data: string; id: string } | null, gcTime: 0, retry: false,
    staleTime: 0, refetchOnWindowFocus: true,
    queryFn: ({ pageParam, signal }) => listarTimelineOs(clienteId, osId, pageParam, signal),
    getNextPageParam: (pagina) => pagina.length === 20 && pagina.at(-1)
      ? { data: pagina.at(-1)!.ocorrido_em, id: pagina.at(-1)!.id } : undefined });
  return <section aria-label="Histórico de status da ordem de serviço"><h3>Histórico de status</h3>
    <p>São estados informados da OS; finalização em campo não substitui validação pelo PCM.</p>
    {consulta.isFetching && <p>Consultando histórico…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && <p>Nenhum evento disponível.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <ol>{consulta.data.pages.flat().map((e) => <li key={e.id}>
      {new Date(e.ocorrido_em).toLocaleString("pt-BR")} · Status informado: {STATUS[e.status]}
    </li>)}</ol>}
    {!consulta.isError && consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Eventos anteriores</button>}
  </section>;
}
