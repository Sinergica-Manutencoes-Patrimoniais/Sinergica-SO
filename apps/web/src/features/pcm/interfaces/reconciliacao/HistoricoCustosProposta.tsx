import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ItensHistoricosCusto } from "./ItensHistoricosCusto";

const valor = z.number().int().nonnegative().safe().nullable();
const linha = z.object({ versao: z.number().int().positive(), criado_em: z.string().datetime({ offset: true }), custo_total_centavos: valor, piso_centavos: valor, preco_sugerido_centavos: valor, preco_centavos: valor }).strict();
const dinheiro = (n: number | null) => n === null ? "não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);

export function HistoricoCustosProposta({ userId, clienteId, propostaId }: { userId: string; clienteId: string; propostaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [versaoAberta, setVersaoAberta] = useState<number | null>(null);
  const consulta = useInfiniteQuery({ queryKey: ["historico-custos-proposta", userId, clienteId, propostaId], enabled: aberto, gcTime: 0, staleTime: 0, retry: false, initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_historico_custos_proposta", { p_cliente_id: clienteId, p_proposta_id: propostaId, p_antes: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linha).max(20).parse(data); let anterior = pageParam ?? Infinity;
      for (const item of pagina) { if (item.versao >= anterior) throw new Error("Página divergente."); anterior = item.versao; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return pagina;
    }, getNextPageParam: (p) => p.length === 20 ? p.at(-1)?.versao : undefined });
  const linhas = consulta.data?.pages.flat() ?? [];
  const consistentes = linhas.every((item, i) => i === 0 || linhas[i - 1]!.versao > item.versao);
  return <section aria-label="Histórico de custos da proposta"><button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar histórico" : "Consultar histórico de custos"}</button>
    {aberto && <><p>Valores registrados em cada versão. Campos indisponíveis não são substituídos pelos atuais.</p>
      {consulta.isFetching && <output>Consultando versões…</output>}{(consulta.isError || !consistentes) && <p role="alert">Histórico indisponível ou divergente. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && consistentes && consulta.data && <><ol>{linhas.map((item) => <li key={item.versao}>Versão {item.versao} · {item.criado_em} · custo {dinheiro(item.custo_total_centavos)} · piso {dinheiro(item.piso_centavos)} · sugerido {dinheiro(item.preco_sugerido_centavos)} · venda {dinheiro(item.preco_centavos)}
        {import.meta.env.VITE_SSO_ITENS_HISTORICOS_CUSTO_ENABLED === "true" && <><button type="button" aria-expanded={versaoAberta === item.versao} onClick={() => setVersaoAberta(versaoAberta === item.versao ? null : item.versao)}>Itens desta versão</button>{versaoAberta === item.versao && <ItensHistoricosCusto userId={userId} clienteId={clienteId} propostaId={propostaId} versao={item.versao} />}</>}</li>)}</ol>{linhas.length === 0 && <p>Nenhuma versão encontrada.</p>}</>}
      {consulta.hasNextPage && !consulta.isError && consistentes && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais versões</button>}</>}
  </section>;
}
