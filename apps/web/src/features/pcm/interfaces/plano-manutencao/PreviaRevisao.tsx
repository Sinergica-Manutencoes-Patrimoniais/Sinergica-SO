import { Button } from "@sinergica/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";

export function PreviaRevisao({ userId, clienteId, planoId, revisao }: { userId: string; clienteId: string; planoId: string; revisao: number }) {
  const consulta = useInfiniteQuery({ queryKey: [...planoManutencaoKeys.raiz(userId, clienteId), planoId, "previa-revisao", revisao],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => supabasePlanoManutencaoAdapter.preverRevisao(planoId, 20, pageParam, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina[pagina.length - 1]?.rotinaLogicaId : undefined,
    gcTime: 0, retry: false });
  const itens = consulta.data?.pages.flat() ?? [];
  const desatualizada = itens.some((item) => item.revisao !== revisao);
  const descricoes = { adicionada: "Adicionada", retirada: "Retirada", alterada: "Alterada", inalterada: "Inalterada" };
  return <section aria-label="Comparação da revisão" className="space-y-2">
    <p>Comparação informativa de conteúdo. Impactos em Ocorrências e OS não foram calculados; o servidor verifica as condições na aprovação.</p>
    {consulta.isFetching && <output>Carregando comparação...</output>}
    {consulta.isError && <p role="alert">Não foi possível comparar a revisão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {desatualizada && <p role="alert">O Plano mudou. Atualize os dados antes de consultar a comparação.</p>}
    {!consulta.isFetching && !consulta.isError && !desatualizada && <>
      {consulta.data && itens.length === 0 && <p>Nenhuma Rotina para comparar.</p>}
      <ul>{itens.map((item) => <li key={item.rotinaLogicaId}>{item.nomeRascunho ?? item.nomeAnterior ?? "Rotina sem nome"} — {descricoes[item.classificacao]}{item.nomeAnterior && item.nomeRascunho && item.nomeAnterior !== item.nomeRascunho ? ` (antes: ${item.nomeAnterior})` : ""}</li>)}</ul>
      {consulta.hasNextPage && <Button variant="secondary" onClick={() => void consulta.fetchNextPage()}>Mais resultados</Button>}
    </>}
  </section>;
}
