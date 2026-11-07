import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ revisao: z.number().int().positive(), estado: z.enum(["inicio_desconhecido", "tempo_excedido_observado", "processamento_encerrado_na_fonte", "novo_processamento_observado"]),
  iniciado_em: z.string().datetime({ offset: true }).nullable(), limite_minutos: z.number().int().min(1).max(10080), criado_em: z.string().datetime({ offset: true }) }).strict();
const rotulos: Record<z.infer<typeof linha>["estado"], string> = { inicio_desconhecido: "início desconhecido", tempo_excedido_observado: "limite ultrapassado",
  processamento_encerrado_na_fonte: "processamento deixou esse estado na fonte", novo_processamento_observado: "novo processamento observado" };
export function HistoricoDemora({ userId, clienteId, outboxId }: { userId: string; clienteId: string; outboxId: string }) {
  const q = useInfiniteQuery({ queryKey: ["reconciliacao-historico-demora", userId, clienteId, outboxId], initialPageParam: 0, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_historico_demora", { p_ator_id: userId, p_cliente_id: clienteId, p_outbox_id: outboxId, p_apos: pageParam, p_limite: 30 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linha).max(30).parse(data); let anterior = pageParam;
      for (const registro of pagina) { if (registro.revisao <= anterior) throw new Error("Página divergente"); anterior = registro.revisao; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada"); return pagina;
    }, getNextPageParam: (p) => p.length === 30 ? p.at(-1)?.revisao : undefined });
  return <section aria-label="Histórico de demora"><p>Observações locais não comprovam falha, sucesso ou ausência de efeito remoto.</p>
    {q.isFetching && <p role="status">Consultando histórico…</p>}{q.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching && !q.isError && q.data && (q.data.pages.flat().length === 0 ? <p>Nenhum evento nesta consulta.</p> : <ul>{q.data.pages.flat().map((e) =>
      <li key={e.revisao}>Revisão {e.revisao} · {rotulos[e.estado]} · início {e.iniciado_em ?? "desconhecido"} · limite {e.limite_minutos} min · registrado {e.criado_em}</li>)}</ul>)}
    {q.hasNextPage && !q.isFetching && !q.isError && <button type="button" onClick={() => void q.fetchNextPage()}>Mais eventos</button>}
  </section>;
}
