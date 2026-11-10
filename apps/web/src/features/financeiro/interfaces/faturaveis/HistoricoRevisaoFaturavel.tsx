import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({ revisao: z.number().int().positive(), tipo: z.enum(["conferido", "cancelado"]),
  valor_anterior_centavos: z.string().regex(/^\d+$/), valor_final_centavos: z.string().regex(/^\d+$/).nullable(),
  motivo: z.string().nullable(), ator_id: z.string().guid(), ocorrido_em: z.string() }).strict();
export function HistoricoRevisaoFaturavel({ usuario, cliente, itemId, revisao }: { usuario: string; cliente: string; itemId: string; revisao: number }) {
  const [aberto, setAberto] = useState(false);
  const lista = useInfiniteQuery({ queryKey: ["historico-revisao-faturavel", usuario, cliente, itemId, revisao], enabled: aberto,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_historico_revisao_faturavel", {
      p_cliente_id: cliente, p_item_id: itemId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data); },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.revisao : undefined });
  if (import.meta.env.VITE_SSO_HISTORICO_REVISAO_FATURAVEL_ENABLED !== "true") return null;
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar revisões" : "Ver revisões"}</button>
    {aberto && lista.isFetching && <p>Consultando revisões…</p>}
    {aberto && lista.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {aberto && !lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma decisão de revisão registrada.</p>}
    {aberto && !lista.isFetching && !lista.isError && lista.data?.pages.flat().map((e) => <p key={e.revisao}>
      Revisão {e.revisao} · {e.tipo} · anterior {e.valor_anterior_centavos} centavos · final {e.valor_final_centavos ?? "não informado"} · responsável {e.ator_id} · {new Date(e.ocorrido_em).toLocaleString("pt-BR")}{e.motivo ? ` · motivo: ${e.motivo}` : ""}
    </p>)}
    {aberto && !lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais revisões</button>}
  </section>;
}
