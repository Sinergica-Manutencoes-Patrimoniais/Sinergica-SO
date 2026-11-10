import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const evento = z.object({ revisao: z.number().int().positive(), estado_local: z.enum(["incerto", "vinculo_observado_nao_confirmado"]),
  sincronizacao: z.string().nullable(), possui_tarefa: z.boolean(),
  fonte_atualizada_em: z.string().datetime({ offset: true }), criado_em: z.string().datetime({ offset: true }) }).strict();

export function HistoricoObservacaoOs({ userId, clienteId, osId }: { userId: string; clienteId: string; osId: string }) {
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-os-observacoes", userId, clienteId, osId], initialPageParam: 0, gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_observacoes_os", {
        p_ator_id: userId, p_cliente_id: clienteId, p_os_id: osId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(evento).max(50).parse(data); let anterior = pageParam;
      for (const item of pagina) { if (item.revisao <= anterior) throw new Error("Página divergente"); anterior = item.revisao; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.revisao : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Histórico de observações locais da OS">
    <h5>Histórico de observações locais</h5>
    <p>Histórico local; não confirma o estado no Auvo.</p>
    {consulta.isFetching && <p role="status">Consultando histórico…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhuma observação registrada.</p> :
      <ol>{itens.map((e) => <li key={e.revisao}>Revisão {e.revisao} · {e.estado_local} · sincronização {e.sincronizacao ?? "não informada"} ·
        {e.possui_tarefa ? " identificador de tarefa registrado" : " sem identificador de tarefa"} · fonte atualizada em {e.fonte_atualizada_em} · observado em {e.criado_em}</li>)}</ol>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais observações</button>}
  </section>;
}
