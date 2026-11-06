import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const id = z.string().uuid();
const linha = z.object({
  intencao_id: id, os_id: id, visita_origem_id: id, visita_destino_id: id,
  tarefa_auvo_id: z.string().regex(/^[1-9][0-9]*$/),
  criado_em: z.string().refine((v) => Number.isFinite(Date.parse(v))),
}).strict();

export function IntencoesReprogramacao({ userId, clienteId, onAbrirOs }: {
  userId: string; clienteId: string; onAbrirOs?: (id: string) => void;
}) {
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-intencoes-reprogramacao", userId, clienteId], gcTime: 0, retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_intencoes_reprogramacao_triagem", {
        p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(50).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const atual = item.intencao_id.toLowerCase();
        if (anterior !== null && atual <= anterior) throw new Error("Página divergente.");
        anterior = atual;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.intencao_id : undefined,
  });
  return <section aria-label="Intenções de reprogramação pendentes">
    <h4>Reprogramações aguardando conferência</h4>
    <p>Intenções locais pendentes; não comprovam alteração no Auvo. Sem envio ou retentativa nesta lista.</p>
    {consulta.isFetching && <output>Carregando intenções…</output>}
    {consulta.isError && <p role="alert">Intenções indisponíveis ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>
      {consulta.data.pages.flat().length === 0 ? <p>Nenhuma intenção pendente encontrada.</p> : <ul>{consulta.data.pages.flat().map((item) => <li key={item.intencao_id}>
        OS {item.os_id} · tarefa Auvo {item.tarefa_auvo_id} · Visitas {item.visita_origem_id} e {item.visita_destino_id} · registrada {new Date(item.criado_em).toLocaleString("pt-BR")}
        {onAbrirOs && <button type="button" onClick={() => onAbrirOs(item.os_id)}>Abrir OS</button>}
      </li>)}</ul>}
      {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais intenções</button>}
    </>}
  </section>;
}
