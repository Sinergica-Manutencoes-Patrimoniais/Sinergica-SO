import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({
  request_id: z.string().guid(), ator_id: z.string().guid(), epoca: z.string().guid(),
  revisao: z.string().regex(/^(0|[1-9][0-9]{0,18})$/), motivo: z.string().min(1).max(2000),
  criado_em: z.string().datetime({ offset: true }),
}).strict();
type Props = { userId: string; clienteId: string; outboxId: string };

export function HistoricoSolicitacoesRecuperacao(props: Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_SOLICITACOES_RECUPERACAO_ENABLED !== "true") return null;
  return <Lista key={JSON.stringify([props.userId, props.clienteId, props.outboxId])} {...props} />;
}
function Lista({ userId, clienteId, outboxId }: Props) {
  const q = useInfiniteQuery({
    queryKey: ["reconciliacao-solicitacoes", userId, clienteId, outboxId],
    initialPageParam: null as string | null, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_solicitacoes_recuperacao", {
        p_ator_id: userId, p_cliente_id: clienteId, p_outbox_id: outboxId, p_apos: pageParam, p_limite: 30,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(item).max(30).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const linha of pagina) {
        if (linha.request_id.toLowerCase() <= anterior) throw new Error("Página divergente.");
        anterior = linha.request_id.toLowerCase();
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 30 ? pagina.at(-1)?.request_id : undefined,
  });
  const linhas = q.data?.pages.flat() ?? [];
  const divergente = linhas.some((linha, i) => i > 0 && linha.request_id.toLowerCase() <= linhas[i - 1]!.request_id.toLowerCase());
  return <section aria-label="Histórico de solicitações de recuperação">
    <h5>Solicitações registradas</h5>
    <p>Histórico local: não confirma recebimento pelo responsável, efeito remoto ou reenvio.</p>
    {q.isFetching && <output>Consultando solicitações…</output>}
    {q.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching && !q.isError && divergente && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void q.refetch()}>Consultar novamente</button></p>}
    {!q.isFetching && !q.isError && !divergente && q.data && <>
      {linhas.length === 0 ? <p>Nenhuma solicitação registrada.</p> : <ul>{linhas.map((linha) => <li key={linha.request_id}>
        {linha.criado_em} · ator {linha.ator_id} · revisão {linha.revisao} · {linha.motivo}
      </li>)}</ul>}
      {q.hasNextPage && <button type="button" onClick={() => void q.fetchNextPage()}>Mais solicitações</button>}
    </>}
  </section>;
}
