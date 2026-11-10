import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { HistoricoObservacaoOrigem } from "./HistoricoObservacaoOrigem";

const linha = z.object({ item_id: z.string().guid(), estado_fonte: z.string(),
  classificacao: z.enum(["declaracao_ausente_conferir", "despesa_indisponivel_conferir"]),
  revisao: z.number().int().positive(), observado_em: z.string().datetime({ offset: true }) }).strict();
export function OrigensDespesaIncompletas({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-origens-despesa-incompletas", userId, clienteId], initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_origens_despesa_incompletas", {
        p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(50).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.item_id <= anterior) throw new Error("Página divergente"); anterior = item.item_id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      return pagina;
    },
    getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.item_id : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Origens de despesa a conferir">
    <h4>Origens de despesa a conferir</h4>
    <p>Resultado da última observação local; os vínculos podem ter mudado. Não confirma erro, pagamento ou sincronização.</p>
    {consulta.isFetching && <p role="status">Consultando origens…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhuma observação encontrada.</p> :
      <ul>{itens.map((item) => <li key={item.item_id}>Faturável {item.item_id} · estado observado {item.estado_fonte} ·
        {item.classificacao === "declaracao_ausente_conferir" ? " declaração não encontrada" : " despesa indisponível para conferência"} · observado em {item.observado_em}
        <button type="button" aria-expanded={selecionado === item.item_id} onClick={() => setSelecionado(selecionado === item.item_id ? null : item.item_id)}>Histórico</button>
        {selecionado === item.item_id && <HistoricoObservacaoOrigem userId={userId} clienteId={clienteId} tipo="financeiro" objetoId={item.item_id} />}
      </li>)}</ul>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais itens</button>}
  </section>;
}
