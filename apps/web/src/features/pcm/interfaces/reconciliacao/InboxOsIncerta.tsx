import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ os_id: z.string().uuid(), numero: z.string(), estado_local: z.string().nullable(), vinculo_local: z.boolean(), declaracao: z.enum(["nenhum", "um", "multiplos", "desconhecido"]).nullable(), declarada_em: z.string().nullable() }).strict();
export function InboxOsIncerta({ userId, clienteId }: { userId: string; clienteId: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["inbox-os-incerta", userId, clienteId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_inbox_os_situacao_incerta", { p_cliente_id: clienteId, p_apos: pageParam, p_limite: 50 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(50).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const id = item.os_id.toLowerCase();
        if (anterior !== null && id <= anterior) throw new Error("Página inconsistente.");
        anterior = id;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.os_id : undefined });
  return <section aria-label="Caixa de triagem de OS"><h4>Caixa de triagem de OS</h4><p>Candidatos com metadados locais; a lista não comprova situação remota nem contém todas as OS. Declarações são manuais e não verificadas. Sem retentativa externa.</p>
    {consulta.isFetching && <output>Carregando candidatos...</output>}{consulta.isError && <p role="alert">Caixa indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {!consulta.isFetching && !consulta.isError && <ul>{consulta.data?.pages.flat().map((x) => <li key={x.os_id}>OS {x.numero} · estado local {x.estado_local ?? "não informado"} · vínculo local {x.vinculo_local ? "presente" : "não identificado"} · declaração {x.declaracao ?? "não registrada"}{x.declarada_em && ` em ${x.declarada_em}`}</li>)}</ul>}
    {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais candidatos</button>}
  </section>;
}
