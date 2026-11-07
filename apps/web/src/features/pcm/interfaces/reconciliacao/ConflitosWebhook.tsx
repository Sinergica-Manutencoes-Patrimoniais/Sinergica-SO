import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ResolverConflitoWebhook } from "./ResolverConflitoWebhook";

const conflitoSchema = z.object({
  id: z.string().guid(), task_id: z.string().regex(/^\d+$/),
  status_remoto: z.enum(["solicitacao", "corretiva", "backlog", "planejamento", "em_execucao", "cancelado"]),
  criado_em: z.string().datetime({ offset: true }), resolvido_em: z.string().datetime({ offset: true }).nullable(),
}).strict();
type Cursor = { data: string; id: string } | null;

export function ConflitosWebhook({ usuario, cliente, os, statusAtual, taskAtual, atualizadoEm }: { usuario: string; cliente: string; os: string; statusAtual?: string; taskAtual?: string | null; atualizadoEm?: string }) {
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-webhook-conflitos", usuario, cliente, os],
    enabled: Boolean(usuario && cliente && os), gcTime: 0, initialPageParam: null as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_conflitos_webhook_autorizado", {
        p_cliente_id: cliente, p_os_id: os, p_apos: pageParam?.data ?? null, p_apos_id: pageParam?.id ?? null, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const itens = z.array(conflitoSchema).max(50).parse(data);
      let anterior = pageParam;
      for (const item of itens) {
        const atual = { data: item.criado_em, id: item.id };
        // Date.parse perde microssegundos; empate em milissegundos não prova empate no banco.
        if (anterior && Date.parse(atual.data) < Date.parse(anterior.data)) throw new Error("Página inválida.");
        anterior = atual;
      }
      return itens;
    },
    getNextPageParam: (pagina) => {
      const ultima = pagina.at(-1);
      return pagina.length === 50 && ultima ? { data: ultima.criado_em, id: ultima.id } : undefined;
    },
  });
  return <section aria-label="Conflitos do webhook">
    <h4>Conflitos de status Auvo</h4>
    <p>Consultar ou anotar não resolve o conflito nem envia ação ao Auvo.</p>
    {consulta.isFetching && <output>Consultando conflitos…</output>}
    {consulta.isError && !consulta.isFetching && <p role="alert">Não foi possível consultar conflitos. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>
      {consulta.data.pages.flat().length === 0 ? <p>Nenhum conflito registrado.</p> : <ul>{consulta.data.pages.flat().map((item) => <li key={item.id}>Auvo {item.task_id} · {item.status_remoto} · {item.resolvido_em ? "Resolvido" : "Aberto"} · {new Date(item.criado_em).toLocaleString("pt-BR")}
        {!item.resolvido_em && import.meta.env.VITE_SSO_RESOLUCAO_CONFLITOS_ENABLED === "true" && statusAtual && atualizadoEm && <ResolverConflitoWebhook usuario={usuario} cliente={cliente} os={os} conflito={item.id} statusRemoto={item.status_remoto} statusAtual={statusAtual} taskId={item.task_id} taskAtual={taskAtual ?? null} atualizadoEm={atualizadoEm} />}
      </li>)}</ul>}
      {consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais conflitos</button>}
    </>}
  </section>;
}
