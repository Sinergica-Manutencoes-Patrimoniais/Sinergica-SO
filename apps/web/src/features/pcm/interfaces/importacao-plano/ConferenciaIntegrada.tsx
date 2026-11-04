import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { conferirLinhasCronograma } from "../../infrastructure/supabase-importacao-plano-adapter";

export function ConferenciaIntegrada({ userId, clienteId, loteId, onSelecionar }: { userId: string; clienteId: string; loteId: string; onSelecionar?: (chave: string) => void }) {
  const q = useInfiniteQuery({ queryKey: ["conferencia-integrada-cronograma", userId, clienteId, loteId], gcTime: 0,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const pagina = await conferirLinhasCronograma(clienteId, loteId, pageParam, signal);
      if (pagina.length > 20 || pagina.some((linha) => typeof linha.chave !== "string" || !linha.chave.trim() || linha.chave.length > 200) || new Set(pagina.map((linha) => linha.chave)).size !== pagina.length) throw new Error("Página inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (page) => page.length === 20 ? page.at(-1)?.chave : undefined });
  const linhas = q.data?.pages.flat() ?? []; const consistentes = new Set(linhas.map((linha) => linha.chave)).size === linhas.length;
  return <section aria-label="Conferência integrada das linhas"><h4>Conferência por linha</h4>
    <p>Alvo válido é verificação no momento da consulta, não aprovação. Um mapeamento, identidade ou situação alterados após a conferência exigem nova revisão. Aprovação e incorporação exigem comandos e verificações separados.</p>
    {q.isFetching && <p>Consultando…</p>}
    {q.isError && <p role="alert">Não foi possível consultar. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!consistentes && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void q.refetch()}>Reconsultar</button></p>}
    {q.data && !q.isError && !q.isFetching && consistentes && <ul>{linhas.map((l) => <li key={l.chave}>Linha {l.chave}: {l.tipo_linha ?? "sem classificação"} · conferência {l.conferencia ?? "não declarada"} · identidade {l.identidade ?? "ausente"} · mapeamento {l.mapeamento_id ? "declarado" : "ausente"} · situação {l.situacao ?? "não declarada"} · alvo {l.alvo_atual} · pendências: {l.pendencias.length ? l.pendencias.join(", ") : "nenhuma detectada nesta consulta"}{onSelecionar && <button type="button" onClick={() => onSelecionar(l.chave)}>Selecionar linha {l.chave}</button>}</li>)}</ul>}
    {q.hasNextPage && <button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>Mais linhas</button>}
  </section>;
}
