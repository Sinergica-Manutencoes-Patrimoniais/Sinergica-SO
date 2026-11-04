import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ConfirmarRetornoPropriedadeFila } from "./ConfirmarRetornoPropriedadeFila";
import { RecuperarConfirmacaoFila } from "./RecuperarConfirmacaoFila";

const linha = z.object({ outbox_id: z.string().uuid(), entidade: z.enum(["sistemas", "equipamentos"]), objeto_id: z.string().uuid(),
  revisao: z.number().int().positive(), situacao: z.enum(["retorno_observado_conferir", "divergencia_observada"]),
  observado_em: z.string().datetime({ offset: true }) }).strict();
export function ConflitosPropriedadeFila({ userId, clienteId }: { userId: string; clienteId: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["reconciliacao-conflitos-fila", userId, clienteId], initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_conflitos_propriedade_fila", { p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(linha).max(50).parse(data); let anterior = pageParam ?? "";
      for (const x of pagina) { if (x.outbox_id <= anterior) throw new Error("Página divergente"); anterior = x.outbox_id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada"); return pagina;
    }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.outbox_id : undefined });
  return <section aria-label="Conflitos de propriedade da fila"><h4>Conflitos de propriedade da fila</h4>
    <p>O histórico anterior não é transferido. A lista não confirma resultado remoto nem autoriza reenvio.</p>
    {consulta.isFetching && <p role="status">Consultando conflitos…</p>}{consulta.isError && <p role="alert">Conflitos indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && <div hidden={consulta.isFetching || consulta.isError}>
      {consulta.data.pages.flat().length === 0 ? <p>Nenhum conflito encontrado nesta consulta.</p> :
        <ul>{consulta.data.pages.flat().map((x) => <li key={x.outbox_id}>Item {x.outbox_id} · {x.entidade === "equipamentos" ? "Componente" : "Sistema"} {x.objeto_id} · revisão {x.revisao} · {x.situacao === "divergencia_observada" ? "divergência de propriedade" : "retorno observado, conferir"} · observado {x.observado_em}
          {import.meta.env.VITE_SSO_CONFIRMAR_RETORNO_FILA_ENABLED === "true" && <ConfirmarRetornoPropriedadeFila key={`${userId}:${clienteId}:${x.outbox_id}`} userId={userId} clienteId={clienteId} outboxId={x.outbox_id} revisao={x.revisao} disponivel={!consulta.isFetching && !consulta.isError} permitido={x.situacao === "retorno_observado_conferir"} />}</li>)}</ul>}
    </div>}
    {import.meta.env.VITE_SSO_CONFIRMAR_RETORNO_FILA_ENABLED === "true" && consulta.data && <RecuperarConfirmacaoFila
      key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} itensCarregados={consulta.data.pages.flat().map((x) => x.outbox_id)}
      disponivel={!consulta.isFetching && !consulta.isError} />}
    {consulta.hasNextPage && !consulta.isFetching && !consulta.isError && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais conflitos</button>}
  </section>;
}
