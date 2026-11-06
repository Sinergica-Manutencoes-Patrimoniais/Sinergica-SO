import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({ pendencia_id: z.string().uuid(), parcela_id: z.string().uuid().nullable(), situacao_parcela: z.string().nullable(), reconciliacao_declarada: z.string().nullable(), reconciliacao_revisao: z.number().int().positive().nullable(), execucao_comprovada: z.literal(false), devolucao_autorizada: z.literal(false) }).strict();
type Props = { userId: string; clienteId: string; composicaoId: string };
export function EscopoEvidencias(props: Props) {
  if (import.meta.env.VITE_SSO_VISAO_ESCOPO_EVIDENCIAS_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.composicaoId])} {...props} />;
}
function Conteudo({ userId, clienteId, composicaoId }: Props) {
  const q = useInfiniteQuery({ queryKey: ["backlog-escopo-evidencias", userId, clienteId, composicaoId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_listar_escopo_evidencias", { p_composicao_id: composicaoId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; return z.array(item).max(20).parse(data); },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.pendencia_id : undefined });
  return <section><h4>Escopo e registros disponíveis</h4><p>Consulta informativa: não comprova execução nem autoriza devolução. Dados podem mudar entre páginas; atualize antes de qualquer decisão.</p>
    {q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Escopo indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {q.data && q.data.pages.flat().length === 0 && <p>Nenhuma Pendência presente nesta composição na consulta.</p>}
    {q.data && <ul>{q.data.pages.flat().map(e => <li key={e.pendencia_id}>Pendência {e.pendencia_id} · {e.parcela_id ? `parcela vinculada ${e.parcela_id}` : "sem vínculo de parcela nesta fonte"} · {e.situacao_parcela ? `situação registrada: ${e.situacao_parcela}` : "situação da parcela desconhecida"} · {e.reconciliacao_declarada ? `reconciliação humana: ${e.reconciliacao_declarada} (revisão ${e.reconciliacao_revisao})` : "sem reconciliação humana registrada nesta fonte"} · execução não comprovada por esta consulta.</li>)}</ul>}
    {q.hasNextPage && <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Mais Pendências</button>}
  </section>;
}
