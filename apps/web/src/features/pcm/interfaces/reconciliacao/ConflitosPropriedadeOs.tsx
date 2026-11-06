import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ConfirmarRetornoPropriedadeOs } from "./ConfirmarRetornoPropriedadeOs";
import { IniciarObservacaoNovoCliente } from "./IniciarObservacaoNovoCliente";

const itemSchema = z.object({ os_id: z.string().uuid(), numero: z.string(), revisao: z.number().int().positive(),
  situacao: z.enum(["retorno_observado_conferir", "retorno_confirmado", "divergencia_observada", "observacao_atual_iniciada"]),
  observado_em: z.string().datetime({ offset: true }), observacao_revisao: z.number().int().positive().nullable().optional() }).strict();
export function ConflitosPropriedadeOs({ userId, clienteId, onAbrirOs }: {
  userId: string; clienteId: string; onAbrirOs?: (osId: string) => void;
}) {
  const consulta = useInfiniteQuery({
    queryKey: ["reconciliacao-conflitos-propriedade-os", userId, clienteId], initialPageParam: null as string | null, gcTime: 0, retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      const { data, error } = await supabase.schema("pcm").rpc(import.meta.env.VITE_SSO_OBSERVACAO_NOVO_CLIENTE_ENABLED === "true" ? "sso_listar_conflitos_propriedade_v2_mediada" : "sso_listar_conflitos_propriedade_mediada", {
        p_ator_id: userId, p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(50).parse(data); let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.os_id <= anterior) throw new Error("Página divergente"); anterior = item.os_id; }
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
      return pagina;
    },
    getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.os_id : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Conflitos de propriedade de OS">
    <h4>Conflitos de propriedade</h4>
    <p>Conferência local pendente; o histórico não foi transferido nem o conflito resolvido.</p>
    {consulta.isFetching && <p role="status">Consultando conflitos…</p>}
    {consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0 ? <p>Nenhum conflito encontrado.</p> :
      <ul>{itens.map((item) => <li key={item.os_id}>OS {item.numero} · revisão {item.revisao} ·
        {item.situacao === "divergencia_observada" ? " divergência de propriedade" : item.situacao === "retorno_confirmado" ? " retorno confirmado" : item.situacao === "observacao_atual_iniciada" ? " observação iniciada no Cliente atual" : " retorno observado, conferir"} · última observação {item.observado_em}
        {onAbrirOs && <button type="button" onClick={() => onAbrirOs(item.os_id)}>Abrir OS</button>}
        {import.meta.env.VITE_SSO_CONFIRMAR_RETORNO_PROPRIEDADE_OS_ENABLED === "true" &&
          <ConfirmarRetornoPropriedadeOs userId={userId} clienteId={clienteId} osId={item.os_id} revisao={item.revisao} permitido={item.situacao === "retorno_observado_conferir"} />}
        {import.meta.env.VITE_SSO_OBSERVACAO_NOVO_CLIENTE_ENABLED === "true" &&
          <IniciarObservacaoNovoCliente key={JSON.stringify([userId, clienteId, item.os_id])} userId={userId} clienteId={clienteId} osId={item.os_id}
            conflitoRevision={item.revisao} observacaoRevision={item.situacao === "divergencia_observada" ? item.observacao_revisao ?? null : null} />}
      </li>)}</ul>)}
    {!consulta.isError && consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais conflitos</button>}
  </section>;
}
