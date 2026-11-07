import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { useState } from "react";
import { AvaliarEvidenciaOs } from "./AvaliarEvidenciaOs";

const evidencia = z.object({ request_id: z.string().guid(), resultado_declarado: z.enum(["nenhum", "um", "multiplos", "desconhecido"]), origem: z.string(), referencia: z.string(), criado_em: z.string() }).strict();
export function EvidenciasOs({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-os-evidencias", userId, clienteId, osId], gcTime: 0,
    initialPageParam: null as { data: string; id: string } | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_evidencias_os_manual", { p_cliente_id: clienteId, p_os_id: osId, p_apos: pageParam?.data ?? null, p_apos_id: pageParam?.id ?? null, p_limite: 50 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(evidencia).max(50).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 && pagina.at(-1) ? { data: pagina[pagina.length - 1]!.criado_em, id: pagina[pagina.length - 1]!.request_id } : undefined,
  });
  return <section aria-label="Evidências declaradas"><h4>Evidências declaradas</h4>
    <p>Declarações humanas não verificadas. Não comprovam o estado remoto nem autorizam nova tentativa.</p>
    {consulta.isFetching && <output>Carregando declarações…</output>}
    {consulta.isError && <p role="alert">Não foi possível carregar declarações. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && <ul>{consulta.data?.pages.flat().map((e) => <li key={e.request_id}>{e.criado_em} · resultado declarado: {e.resultado_declarado} · origem: {e.origem} · referência: {e.referencia}
      {import.meta.env.VITE_SSO_AVALIACAO_EVIDENCIA_OS_ENABLED === "true" && <button type="button" onClick={() => setSelecionada(selecionada === e.request_id ? null : e.request_id)}>Avaliação interna</button>}
      {selecionada === e.request_id && import.meta.env.VITE_SSO_AVALIACAO_EVIDENCIA_OS_ENABLED === "true" && <AvaliarEvidenciaOs userId={userId} clienteId={clienteId} osId={osId} evidenciaId={e.request_id} />}
    </li>)}</ul>}
    {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais declarações</button>}
  </section>;
}
