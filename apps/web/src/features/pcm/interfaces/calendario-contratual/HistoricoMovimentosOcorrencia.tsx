import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ revisao_visita: z.number().int().positive(), vencimento_original: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inicio_anterior: z.string().datetime({ offset: true }), inicio_novo: z.string().datetime({ offset: true }), criado_em: z.string().datetime({ offset: true }) }).strict();
export function HistoricoMovimentosOcorrencia({ userId, clienteId, visitaId, ocorrenciaId }: { userId: string; clienteId: string; visitaId: string; ocorrenciaId: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["movimentos-ocorrencia-dia", userId, clienteId, visitaId, ocorrenciaId], initialPageParam: 0, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_movimentos_ocorrencia_dia", { p_ator_id: userId, p_cliente_id: clienteId,
        p_visita_id: visitaId, p_ocorrencia_id: ocorrenciaId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linha).max(30).parse(data); let anterior = pageParam;
      for (const item of pagina) { if (item.revisao_visita <= anterior) throw new Error("Página divergente"); anterior = item.revisao_visita; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada"); return pagina;
    }, getNextPageParam: (p) => p.length === 30 ? p.at(-1)?.revisao_visita : undefined });
  return <section aria-label="Histórico de programação da ocorrência">
    <p>Histórico de programação: o vencimento original permanece separado e não comprova execução.</p>
    {consulta.isFetching && <p role="status">Consultando histórico…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (consulta.data.pages.flat().length === 0 ? <p>Nenhuma mudança registrada neste histórico.</p> :
      <ul>{consulta.data.pages.flat().map((m) => <li key={m.revisao_visita}>Revisão {m.revisao_visita}: vencimento original {m.vencimento_original} · programação de {m.inicio_anterior} para {m.inicio_novo}.</li>)}</ul>)}
    {consulta.hasNextPage && !consulta.isFetching && !consulta.isError && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais movimentos</button>}
  </section>;
}
