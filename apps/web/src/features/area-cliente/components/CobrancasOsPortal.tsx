import { useInfiniteQuery } from "@tanstack/react-query";
import { listarCobrancasOs } from "../infrastructure/supabase-portal-cobrancas-os-adapter";
import { DocumentosCobranca } from "./DocumentosCobranca";

export function CobrancasOsPortal(props: { userId: string; clienteId: string; osId: string }) {
  if (import.meta.env.VITE_SSO_PORTAL_COBRANCA_OS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.osId])} {...props} />;
}
function Conteudo({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["portal-cobrancas-os", userId, clienteId, osId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listarCobrancasOs(clienteId, osId, pageParam, signal, userId),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.lancamento_id : undefined,
    gcTime: 0, staleTime: 0, refetchOnWindowFocus: true, retry: false });
  const cobrancas = consulta.data?.pages.flat() ?? [];
  const divergentes = cobrancas.some((item, i) => i > 0 && item.lancamento_id.toLowerCase() <= cobrancas[i - 1]!.lancamento_id.toLowerCase());
  return <section aria-label="Cobranças da ordem de serviço"><h3>Cobranças da OS</h3>
    {consulta.isFetching && <p>Consultando cobranças…</p>}
    {consulta.isError && <p role="alert">Cobranças indisponíveis ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && divergentes && <p role="alert">As páginas de cobranças divergiram. <button type="button" onClick={() => void consulta.refetch()}>Consultar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && !divergentes && consulta.data && cobrancas.length === 0 && <p>Nenhuma cobrança publicada.</p>}
    {!consulta.isFetching && !consulta.isError && !divergentes && cobrancas.map((c) => <div key={c.lancamento_id}>
      <p>{c.descricao} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.valor_centavos / 100)}</p>
      <p>Competência {c.competencia} · Vencimento {c.vencimento ?? "não informado"} · {c.situacao.replaceAll("_", " ")}</p>
      {import.meta.env.VITE_SSO_DOCUMENTO_COBRANCA_ENABLED === "true" && <DocumentosCobranca userId={userId} clienteId={clienteId} osId={osId} lancamentoId={c.lancamento_id} />}
    </div>)}
    {!consulta.isError && !divergentes && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => { if (!consulta.isFetching) void consulta.fetchNextPage(); }}>Mais cobranças</button>}
  </section>;
}
