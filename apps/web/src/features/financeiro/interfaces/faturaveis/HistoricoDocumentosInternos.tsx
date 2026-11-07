import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ documento_id: z.string().guid(), revisao_item: z.number().int(), valor_centavos: z.string(), criado_em: z.string(), estado: z.enum(["reservado", "liberado", "convertido"]), alocacao_id: z.string().guid().nullable(), alocacao_centavos: z.string().nullable(), alocacao_estornada: z.boolean() }).strict();
export function HistoricoDocumentosInternos({ usuario, cliente, itemId }: { usuario: string; cliente: string; itemId: string }) {
  const consulta = useInfiniteQuery({ queryKey: ["documento-interno-historico", usuario, cliente, itemId], gcTime: 0, initialPageParam: null as { data: string; id: string } | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_historico_documentos_internos", { p_cliente_id: cliente, p_item_id: itemId, p_antes: pageParam?.data ?? null, p_antes_id: pageParam?.id ?? null, p_limite: 50 }).abortSignal(signal); if (error) throw error; return z.array(linha).parse(data); },
    getNextPageParam: (pagina) => pagina.length === 50 && pagina.at(-1) ? { data: pagina[pagina.length - 1]!.criado_em, id: pagina[pagina.length - 1]!.documento_id } : undefined });
  return <section aria-label="Histórico de documentos internos"><h5>Histórico de parcelas internas</h5><p>Documento interno não é nota fiscal ou comprovação de pagamento.</p>
    {consulta.isFetching && <output>Consultando histórico...</output>}{consulta.isError && <p role="alert">Histórico indisponível ou sem permissão. <button type="button" onClick={() => void consulta.refetch()}>Reconsultar</button></p>}
    {!consulta.isError && <ul>{consulta.data?.pages.flat().map((x) => <li key={x.documento_id}>{x.criado_em} · documento {x.documento_id} · revisão {x.revisao_item} · {x.valor_centavos} centavos · {x.estado} {x.alocacao_id ? `· alocação ${x.alocacao_id}, ${x.alocacao_centavos} centavos${x.alocacao_estornada ? ", estornada" : ""}` : x.estado === "convertido" ? "· alocação não encontrada: investigar" : ""}</li>)}</ul>}
    {consulta.hasNextPage && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais parcelas</button>}
  </section>;
}
