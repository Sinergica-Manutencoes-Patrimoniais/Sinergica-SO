import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PedidoReconciliacaoCronograma } from "../../infrastructure/supabase-reconciliacao-cronograma";
import { ReconciliarLegado } from "./ReconciliarLegado";

type Lote = { id: string; fonte: string; revisao: number; criadoEm: string; reconciliado: boolean };
type Props = { userId: string; clienteId: string; listar: (cliente: string, apos: string | null, signal?: AbortSignal) => Promise<Lote[]>; enviar: (pedido: PedidoReconciliacaoCronograma) => Promise<void> };

/** Superfície isolada: serviços são injetados; não ativa nem usa endpoints reais por padrão. */
export function LotesLegados(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Conteudo({ userId, clienteId, listar, enviar }: Props) {
  const cache = useQueryClient();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const chave = ["cronograma-legado", userId, clienteId] as const;
  const consulta = useInfiniteQuery({
    queryKey: chave, gcTime: 0, initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listar(clienteId, pageParam, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined,
  });
  const lotes = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Lotes legados de cronograma">
    <h3>Lotes legados</h3>
    <p>A consulta mostra metadados, não valida o conteúdo nem comprova que o lote pode ser transportado.</p>
    {consulta.isPending && <output>Carregando lotes…</output>}
    {consulta.isError && <p role="alert">Não foi possível carregar lotes. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isPending && !consulta.isError && <>
      {lotes.length === 0 && <p>Nenhum lote legado encontrado.</p>}
      <ul>{lotes.map((lote) => <li key={lote.id}>
        <span>{lote.fonte} — {lote.reconciliado ? "reconciliado" : "pendente"}</span>{" "}
        <button type="button" onClick={() => setSelecionado(lote.id)}>Conferir {lote.fonte}</button>
        {selecionado === lote.id && <ReconciliarLegado userId={userId} clienteId={clienteId} lote={lote} enviar={async (p) => { await enviar(p); await cache.invalidateQueries({ queryKey: chave }); }} />}
      </li>)}</ul>
      {consulta.hasNextPage && <button type="button" disabled={consulta.isFetchingNextPage} onClick={() => void consulta.fetchNextPage()}>Mais lotes</button>}
      {consulta.isFetchingNextPage && <output>Carregando mais lotes…</output>}
    </>}
  </section>;
}
