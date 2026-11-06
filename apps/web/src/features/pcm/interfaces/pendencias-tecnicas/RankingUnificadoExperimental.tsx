import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const itemSchema = z.object({ tipo: z.enum(["composicao", "retorno", "retorno_parcial"]), id: z.string().uuid(), composicao_id: z.string().uuid(),
  pendencia_id: z.string().uuid().nullable(), alvo_tipo: z.enum(["sistema", "componente", "grupo"]), alvo_id: z.string().uuid(),
  score: z.string().regex(/^[0-5](?:\.[0-9]{1,40})?$/).nullable(), revisao: z.number().int().positive(), assinatura: z.string().regex(/^[a-f0-9]{32}$/) }).strict()
  .refine((item) => item.tipo === "composicao" ? item.pendencia_id === null && item.id === item.composicao_id : item.pendencia_id !== null);
type Item = z.infer<typeof itemSchema>;
type Cursor = { tipo: Item["tipo"] | null; id: string | null; score: string | null; assinatura: string | null };

function compararDecimal(a: string, b: string): number {
  const [inteiroA, fracaoA = ""] = a.split(".");
  const [inteiroB, fracaoB = ""] = b.split(".");
  if (inteiroA !== inteiroB) return inteiroA! < inteiroB! ? -1 : 1;
  const tamanho = Math.max(fracaoA.length, fracaoB.length);
  const esquerda = fracaoA.padEnd(tamanho, "0"); const direita = fracaoB.padEnd(tamanho, "0");
  return esquerda === direita ? 0 : esquerda < direita ? -1 : 1;
}

/** Consulta experimental separada da fila oficial; flags e RPC privada mantêm o gate fechado. */
export function RankingUnificadoExperimental({ userId, clienteId, onAbrirParcial }: { userId: string; clienteId: string; onAbrirParcial?: (id: string) => void }) {
  if (import.meta.env.VITE_SSO_RANKING_UNIFICADO_ENABLED !== "true") return null;
  return <Conteudo key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} onAbrirParcial={onAbrirParcial} />;
}
function Conteudo({ userId, clienteId, onAbrirParcial }: { userId: string; clienteId: string; onAbrirParcial?: (id: string) => void }) {
  const incluirParciais = import.meta.env.VITE_SSO_RANKING_RETORNO_PARCIAL_ENABLED === "true";
  const consulta = useInfiniteQuery({
    queryKey: ["backlog-ranking-unificado", userId, clienteId, incluirParciais], gcTime: 0, refetchOnWindowFocus: true,
    initialPageParam: { tipo: null, id: null, score: null, assinatura: null } as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const parametros = { p_cliente_id: clienteId, p_limite: 50, p_apos_tipo: pageParam.tipo, p_apos_id: pageParam.id, p_apos_score: pageParam.score, p_assinatura: pageParam.assinatura };
      const requisicao = incluirParciais ? supabase.schema("pcm").rpc("sso_ranking_backlog_com_parciais", { ...parametros, p_ator_id: userId })
        : supabase.schema("pcm").rpc("sso_ranking_backlog_unificado_exato", parametros);
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(50).parse(data);
      if (!incluirParciais && pagina.some((item) => item.tipo === "retorno_parcial")) throw new Error("Fonte divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      let anterior: { tipo: Item["tipo"]; id: string; score: string | null } | null = pageParam.tipo && pageParam.id
        ? { tipo: pageParam.tipo, id: pageParam.id, score: pageParam.score } : null;
      const assinatura = pageParam.assinatura ?? pagina[0]?.assinatura;
      for (const item of pagina) {
        if (item.assinatura !== assinatura) throw new Error("Fotografia de ranking divergente.");
        if (anterior) {
          const comparacao = item.score !== null && anterior.score !== null ? compararDecimal(item.score, anterior.score) : null;
          const igual = item.score === null && anterior.score === null || comparacao === 0;
          const foraDeOrdem = anterior.score === null ? item.score !== null : comparacao !== null && comparacao > 0;
          if (foraDeOrdem || (igual && (item.tipo < anterior.tipo || (item.tipo === anterior.tipo && item.id <= anterior.id)))) throw new Error("Página de ranking divergente.");
        }
        anterior = item;
      }
      return pagina;
    },
    getNextPageParam: (pagina): Cursor | undefined => {
      const ultimo = pagina.at(-1);
      return pagina.length === 50 && ultimo ? { tipo: ultimo.tipo, id: ultimo.id, score: ultimo.score, assinatura: ultimo.assinatura } : undefined;
    },
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Ranking unificado experimental">
    <h4>Ranking unificado experimental</h4>
    <p>Composições ainda sem Chamado e retornos registrados são ordenados juntos. Prioridade de retorno é herdada e precisa de revisão; não comprova parada, não autoriza promoção e não substitui a fila oficial.</p>
    {consulta.isFetching && <output>Consultando ranking…</output>}
    {consulta.isError && <p role="alert">Ranking indisponível ou alterado. <button type="button" onClick={() => void consulta.refetch()}>Recarregar</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhum item encontrado.</p> : <ol>{itens.map((item) => <li key={`${item.tipo}:${item.id}`}>
      {item.tipo === "retorno" ? "Retorno integral" : item.tipo === "retorno_parcial" ? "Retorno parcial" : "Composição"} {item.id} · {item.alvo_tipo} {item.alvo_id} · {item.score === null ? "prioridade não calculada" : `GUTD ${item.score}`} · revisão {item.revisao}.
      {item.pendencia_id && <p>Pendência de origem {item.pendencia_id}; composição de origem {item.composicao_id}.</p>}
      {item.tipo === "retorno_parcial" && onAbrirParcial && <button type="button" onClick={() => onAbrirParcial(item.id)}>Conferir retorno parcial</button>}
    </li>)}</ol>)}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais itens</button>}
  </section>;
}
