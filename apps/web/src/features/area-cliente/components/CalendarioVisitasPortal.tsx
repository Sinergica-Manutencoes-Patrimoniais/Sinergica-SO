import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

type Props = { userId: string; clienteId: string };
const item = z.object({ id: z.string().guid(), os_id: z.string().guid(), os_numero: z.string(), inicio_em: z.string(), fim_em: z.string(), mensagem: z.string() }).strict();
export function CalendarioVisitasPortal(props: Props) {
  if (import.meta.env.VITE_SSO_PORTAL_CALENDARIO_VISITAS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Conteudo({ userId, clienteId }: Props) {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 4, 1).toISOString();
  const consulta = useInfiniteQuery({ queryKey: ["portal-calendario-visitas", userId, clienteId, inicio, fim], gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, initialPageParam: null as { inicio: string; id: string } | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_portal_calendario_visitas", {
        p_cliente_id: clienteId, p_inicio: inicio, p_fim: fim, p_apos_inicio: pageParam?.inicio ?? null, p_apos_id: pageParam?.id ?? null,
      }).abortSignal(signal);
      if (error) throw error; return z.array(item).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 50 ? { inicio: pagina[pagina.length - 1]!.inicio_em, id: pagina[pagina.length - 1]!.id } : undefined });
  return <section className="rounded-xl border border-line bg-card p-5" aria-label="Visitas comunicadas">
    <h2 className="font-semibold">Visitas comunicadas</h2><p>Período: mês atual e próximos três meses. Cada comunicação corresponde a uma OS.</p>
    {consulta.isFetching && <p>Consultando visitas…</p>}
    {consulta.isError && <p role="alert">Visitas indisponíveis ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && <p>Nenhuma visita comunicada neste período.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().map((v) => <div key={v.id}>
      <p>{new Date(v.inicio_em).toLocaleString("pt-BR")} – {new Date(v.fim_em).toLocaleString("pt-BR")}</p><p>{v.mensagem}</p>
      <p>OS {v.os_numero} · Consulte a OS para registrar ciência informativa.</p>
    </div>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais visitas</button>}
  </section>;
}
