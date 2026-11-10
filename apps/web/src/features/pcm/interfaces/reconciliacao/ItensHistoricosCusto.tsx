import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const numero = z.number().int().nonnegative().safe().nullable();
const resposta = z.object({ versao: z.number().int().positive(), disponivel: z.boolean(), total: z.number().int().nonnegative().max(10000).nullable(), itens: z.array(z.object({ posicao: z.number().int().positive(), tipo: z.string().nullable(), descricao: z.string().nullable(), quantidade: z.number().finite().nullable(), custoUnitarioCentavos: numero, totalCentavos: numero }).strict()).max(50) }).strict();
const dinheiro = (n: number | null) => n === null ? "não informado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);
export function ItensHistoricosCusto({ userId, clienteId, propostaId, versao }: { userId: string; clienteId: string; propostaId: string; versao: number }) {
  const consulta = useInfiniteQuery({ queryKey: ["itens-historicos-custo", userId, clienteId, propostaId, versao], initialPageParam: 0, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_itens_historicos_custo", { p_cliente_id: clienteId, p_proposta_id: propostaId, p_versao: versao, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error; const pagina = resposta.parse(data); if (pagina.versao !== versao || (pagina.disponivel !== (pagina.total !== null))) throw new Error("Versão divergente.");
      let anterior = pageParam; for (const item of pagina.itens) { if (item.posicao <= anterior || (pagina.total !== null && item.posicao > pagina.total)) throw new Error("Página divergente."); anterior = item.posicao; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return pagina;
    }, getNextPageParam: (pagina) => pagina.disponivel && pagina.itens.length === 50 && pagina.itens.at(-1)!.posicao < pagina.total! ? pagina.itens.at(-1)!.posicao : undefined });
  const paginas = consulta.data?.pages ?? []; const linhas = paginas.flatMap((p) => p.itens);
  const consistentes = paginas.every((p) => p.disponivel === paginas[0]?.disponivel && p.total === paginas[0]?.total) && linhas.every((v, i) => i === 0 || linhas[i - 1]!.posicao < v.posicao);
  return <section aria-label={`Itens da versão ${versao}`}><p>Itens registrados na versão {versao}.</p>
    {consulta.isFetching && <output>Consultando itens históricos…</output>}{(consulta.isError || !consistentes) && <p role="alert">Itens indisponíveis ou divergentes. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consistentes && paginas[0] && <>{!paginas[0].disponivel ? <p>Esta versão não registra itens na fotografia.</p> : <><ul>{linhas.map((i) => <li key={i.posicao}>{i.posicao} · {i.tipo ?? "tipo não informado"} · {i.descricao ?? "descrição não informada"} · quantidade {i.quantidade ?? "não informada"} · unitário {dinheiro(i.custoUnitarioCentavos)} · total {dinheiro(i.totalCentavos)}</li>)}</ul>{paginas[0].total === 0 && <p>A fotografia registra uma lista vazia.</p>}</>}</>}
    {consulta.hasNextPage && !consulta.isError && consistentes && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais itens</button>}
  </section>;
}
