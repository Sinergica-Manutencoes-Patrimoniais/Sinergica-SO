import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const conflito = z.object({ envelope_id: z.string().guid(), estado: z.enum(["conflito_regressao", "conflito_ordem"]),
  registrado_em: z.string().datetime({ offset: true }) }).strict();

export function ConflitosCampo({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const [aberto, setAberto] = useState(false);
  const q = useInfiniteQuery({ queryKey: ["estado-origem-campo", userId, clienteId, osId, "conflitos"], enabled: aberto, gcTime: 0, retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_conflitos_campo", {
        p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_apos: pageParam, p_limite: 20,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(conflito).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) { const id = item.envelope_id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página divergente."); anterior = id; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.envelope_id : undefined });
  const itens = !q.isFetching && !q.isError ? q.data?.pages.flat() ?? [] : [];
  return <section aria-label={`Conflitos de campo da OS ${osId}`}>
    <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar conflitos" : "Consultar conflitos"}</button>
    {aberto && <><p>Registros históricos exigem triagem; a consulta não resolve conflitos nem comprova ausência de outros eventos.</p>
      {q.isFetching && <output>Consultando conflitos…</output>}
      {q.isError && <p role="alert">Conflitos indisponíveis. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
      {!q.isFetching && !q.isError && q.data && (itens.length ? <ul>{itens.map((i) => <li key={i.envelope_id}>
        {i.estado === "conflito_regressao" ? "Mudança de estado regressiva" : "Mesma ordem com conteúdo diferente"} · envelope {i.envelope_id} · <time dateTime={i.registrado_em}>{new Date(i.registrado_em).toLocaleString("pt-BR")}</time>
      </li>)}</ul> : <p>Nenhum conflito nesta consulta.</p>)}
      {!q.isError && q.hasNextPage && <button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>Mais conflitos</button>}
    </>}
  </section>;
}
