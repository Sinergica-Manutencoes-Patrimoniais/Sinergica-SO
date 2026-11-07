import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ request_id: z.string().guid(), os_id: z.string().guid(), revisao: z.number().int().positive(), elegivel_em: z.string(), criado_em: z.string() }).strict();
export function HistoricoIntencaoLocal({ userId, clienteId, visitaId }: { userId: string; clienteId: string; visitaId: string }) {
  const [aberto, setAberto] = useState(false);
  const lista = useInfiniteQuery({ queryKey: ["visitas", userId, clienteId, visitaId, "intencoes-locais"], enabled: aberto,
    gcTime: 0, staleTime: 0, retry: false, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_listar_intencoes_locais", {
      p_cliente_id: clienteId, p_visita_id: visitaId, p_request_id: null, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(linha).max(20).parse(data); }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.request_id : undefined });
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar intenções locais" : "Ver minhas intenções locais"}</button>
    {aberto && <><p>São registros históricos bloqueados, não filas nem tarefas enviadas. A janela informada não comprova elegibilidade atual.</p>
      {lista.isFetching && <p>Consultando intenções…</p>}{lista.isError && <p role="alert">Consulta indisponível ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma intenção local da sua autoria.</p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().map((i) => <p key={i.request_id}>OS {i.os_id} · revisão {i.revisao} · pedido {i.request_id} · criado em {new Date(i.criado_em).toLocaleString("pt-BR")} · janela {new Date(i.elegivel_em).toLocaleString("pt-BR")}</p>)}
      {!lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais intenções</button>}</>}
  </section>;
}
