import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({ lancamento_id: z.string().guid(), descricao: z.string(), valor_centavos: z.string().regex(/^\d+$/),
  data_competencia: z.string(), documento_ref: z.string().nullable(), situacao: z.enum(["sem_documento_sso", "sem_alocacao_ativa"]) }).strict();
export function DiagnosticoDocumentos({ usuario, cliente, competencia }: { usuario: string; cliente: string; competencia: string }) {
  const [aberto, setAberto] = useState(false);
  const lista = useInfiniteQuery({ queryKey: ["diagnostico-documentos", usuario, cliente, competencia], enabled: aberto,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("financeiro").rpc("sso_diagnostico_documentos_competencia", {
        p_cliente_id: cliente, p_competencia: `${competencia}-01`, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.lancamento_id : undefined });
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar diagnóstico" : "Diagnosticar entradas sem alocação ativa"}</button>
    {aberto && <p>A listagem é informativa: nem todo lançamento exige alocação. Estorno lógico não comprova reconciliação ou pagamento.</p>}
    {aberto && lista.isFetching && <p>Consultando lançamentos…</p>}
    {aberto && lista.isError && <p role="alert">Diagnóstico indisponível ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {aberto && !lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma entrada encontrada nesta condição.</p>}
    {aberto && !lista.isFetching && !lista.isError && lista.data?.pages.flat().map((l) => <article key={l.lancamento_id}>
      <p>{l.descricao || "Sem descrição"} · {l.valor_centavos} centavos · competência {l.data_competencia}</p>
      <p>{l.situacao === "sem_documento_sso" ? "Sem documento associado neste fluxo" : `Documento ${l.documento_ref ?? "sem referência"}, sem alocação ativa`}</p>
    </article>)}
    {aberto && !lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais lançamentos</button>}
  </section>;
}
