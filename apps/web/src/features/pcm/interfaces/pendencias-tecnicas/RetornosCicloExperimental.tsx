import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { PromoverRetornoCiclo } from "./PromoverRetornoCiclo";
import { HistoricoPromocaoIntegral } from "./HistoricoPromocaoIntegral";

const itemSchema = z.object({ id: z.string().uuid(), ciclo_id: z.string().uuid(), pendencia_id: z.string().uuid(),
  composicao_id: z.string().uuid(), chamado_id: z.string().uuid(), parcela_id: z.string().uuid(), os_id: z.string().uuid(),
  reconciliacao_id: z.string().uuid(), estado: z.enum(["aguardando", "promovido"]), revisao: z.number().int().positive(),
  criado_em: z.string().datetime({ offset: true }) }).strict();

/** Consulta experimental separada da fila e do ranking oficiais. */
export function RetornosCicloExperimental({ userId, clienteId }: { userId: string; clienteId: string }) {
  if (import.meta.env.VITE_SSO_RETORNO_CICLO_ENABLED !== "true") return null;
  return <Conteudo key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} />;
}
function Conteudo({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["backlog-retornos-ciclo", userId, clienteId], gcTime: 0, refetchOnWindowFocus: true,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_retornos_ciclo", { p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(50).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      let anterior = pageParam ?? "";
      for (const item of pagina) { if (item.id <= anterior) throw new Error("Página divergente."); anterior = item.id; }
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.id : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  return <section aria-label="Retornos de escopo experimentais">
    <h4>Retornos de escopo experimentais</h4>
    <p>Lista isolada, não é a fila ou o ranking oficial. Declarações não comprovam parada; páginas podem mudar durante a consulta.</p>
    {consulta.isFetching && <output>Consultando retornos…</output>}
    {consulta.isError && <p role="alert">Retornos indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && <div hidden={consulta.isFetching || consulta.isError}>{itens.length === 0 ? <p>Nenhum retorno encontrado.</p> : <ol>{itens.map((item) => <li key={item.id}>
      Pendência {item.pendencia_id} · Chamado {item.chamado_id} · parcela {item.parcela_id} · {item.estado} · revisão {item.revisao}.
      <p>Ciclo {item.ciclo_id} · composição {item.composicao_id} · OS {item.os_id} · reconciliação {item.reconciliacao_id}.</p>
      {import.meta.env.VITE_SSO_HISTORICO_PROMOCAO_INTEGRAL_ENABLED === "true" && <HistoricoPromocaoIntegral key={`${userId}:${clienteId}:${item.id}`} userId={userId} clienteId={clienteId} retornoId={item.id}/>}
      {import.meta.env.VITE_SSO_PROMOCAO_RETORNO_ENABLED === "true" && <><button type="button" aria-expanded={selecionado === item.id} onClick={() => setSelecionado(selecionado === item.id ? null : item.id)}>{selecionado === item.id ? "Fechar promoção" : "Abrir promoção ou recuperar pedido"}</button>
        {selecionado === item.id && <PromoverRetornoCiclo key={`${userId}:${clienteId}:${item.id}`} userId={userId} clienteId={clienteId} retornoId={item.id} revisao={item.revisao} estado={item.estado} consultaDisponivel={!consulta.isFetching && !consulta.isError} />}</>}
    </li>)}</ol>}</div>}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais retornos</button>}
  </section>;
}
