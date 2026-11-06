import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ alocacao_id: z.string().uuid(), item_id: z.string().uuid(), competencia_item: z.string(), data_documento: z.string().nullable(), competencia_lancamento: z.string().nullable(), situacao: z.enum(["documento_indisponivel_ou_fora_escopo", "lancamento_indisponivel_ou_fora_escopo", "meses_diferentes_conferir", "meses_coincidentes"]) }).strict();
export function ConferirDatasDocumentos({ usuario, cliente, competencia }: { usuario: string; cliente: string; competencia: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["faturavel-datas-documentos", usuario, cliente, competencia], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_conferir_datas_documentos", { p_cliente_id: cliente, p_competencia: `${competencia}-01`, p_apos: pageParam, p_limite: 50 }).abortSignal(signal); if (error) throw error; return z.array(linha).parse(data); }, getNextPageParam: (p) => p.length === 50 ? p.at(-1)?.alocacao_id : undefined });
  return <section aria-label="Conferência de datas de documentos"><h4>Conferência de datas</h4><p>Meses diferentes pedem conferência; não são automaticamente erro contábil.</p>
    {consulta.isFetching && <output>Consultando datas...</output>}{consulta.isError && <p role="alert">Consulta indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {!consulta.isError && <ul>{consulta.data?.pages.flat().map((x) => <li key={x.alocacao_id}>Item {x.item_id} · competência {x.competencia_item} · data do documento {x.data_documento ?? "indisponível"} · competência do lançamento {x.competencia_lancamento ?? "indisponível"} · {x.situacao}</li>)}</ul>}
    {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais registros</button>}
  </section>;
}
