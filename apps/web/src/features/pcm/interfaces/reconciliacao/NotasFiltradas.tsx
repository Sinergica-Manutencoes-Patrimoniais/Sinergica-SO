import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const nota = z.object({ request_id: z.string().guid(), ator_id: z.string().guid(), observacao: z.string(), status_observado: z.enum(["pending", "processing", "sent", "error"]), tentativas_observadas: z.number().int().nonnegative(), criado_em: z.string() }).strict();
export function NotasFiltradas({ userId, clienteId, outboxId }: { userId: string; clienteId: string; outboxId: string }) {
  const [minhas, setMinhas] = useState(false); const [estado, setEstado] = useState("");
  const consulta = useInfiniteQuery({ queryKey: ["reconciliacao-notas-filtradas", userId, clienteId, outboxId, minhas, estado], gcTime: 0, initialPageParam: null as { data: string; id: string } | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_listar_notas_fila_filtradas", { p_cliente_id: clienteId, p_outbox_id: outboxId, p_ator: minhas ? userId : null, p_estado: estado || null, p_tentativas: null, p_apos: pageParam?.data ?? null, p_apos_id: pageParam?.id ?? null, p_limite: 50 }).abortSignal(signal); if (error) throw error; return z.array(nota).parse(data); },
    getNextPageParam: (pagina) => pagina.length === 50 && pagina.at(-1) ? { data: pagina[pagina.length - 1]!.criado_em, id: pagina[pagina.length - 1]!.request_id } : undefined });
  return <section aria-label="Notas filtradas"><h4>Histórico filtrado</h4><p>O número de tentativas é um dado observado, não uma revisão da fila.</p>
    <label><input type="checkbox" checked={minhas} onChange={(e) => setMinhas(e.target.checked)} /> Apenas minhas notas</label>{" "}
    <label>Estado observado <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option><option value="pending">Pendente</option><option value="processing">Processando</option><option value="error">Erro</option><option value="sent">Enviado</option></select></label>
    {consulta.isFetching && <output>Consultando notas...</output>}{consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isError && <ul>{consulta.data?.pages.flat().map((n) => <li key={n.request_id}>{n.criado_em} · {n.status_observado} · {n.tentativas_observadas} tentativa(s) · {n.observacao}</li>)}</ul>}
    {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais notas</button>}
  </section>;
}
