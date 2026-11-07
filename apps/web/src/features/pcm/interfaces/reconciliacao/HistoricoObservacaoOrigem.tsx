import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const evento = z.object({ revisao: z.number().int().positive(), estado_fonte: z.string(), classificacao: z.string(),
  criado_em: z.string().datetime({ offset: true }) }).strict();
export function HistoricoObservacaoOrigem({ userId, clienteId, tipo, objetoId }: {
  userId: string; clienteId: string; tipo: "comercial" | "financeiro"; objetoId: string;
}) {
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-observacoes-origem", userId, clienteId, tipo, objetoId], initialPageParam: 0, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_historico_observacao_origem", {
        p_ator_id: userId, p_cliente_id: clienteId, p_tipo: tipo, p_objeto_id: objetoId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(evento).max(50).parse(data); let anterior = pageParam;
      for (const e of pagina) { if (e.revisao <= anterior) throw new Error("Página divergente"); anterior = e.revisao; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      return pagina;
    },
    getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.revisao : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Histórico de observações da origem">
    <h5>Observações locais</h5><p>Registro local não confirma pagamento, sincronização ou resolução.</p>
    {consulta.isFetching && <p role="status">Consultando histórico…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhuma observação registrada.</p> :
      <ol>{itens.map((e) => <li key={e.revisao}>Revisão {e.revisao} · {e.estado_fonte} · {e.classificacao} · {e.criado_em}</li>)}</ol>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais observações</button>}
  </section>;
}
