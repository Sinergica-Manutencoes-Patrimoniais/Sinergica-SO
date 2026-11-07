import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Props = { userId: string; clienteId: string; composicaoId: string };
const evento = z.object({ request_id: z.string().guid(), ator_id: z.string().guid(), itens: z.array(z.object({ id: z.string().guid(), revision: z.number().int().positive() }).strict()).min(1).max(100) }).strict();
export function HistoricoSelecao(props: Props) {
  if (import.meta.env.VITE_SSO_HISTORICO_SELECAO_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId, props.composicaoId])} {...props} />;
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Ocultar seleção original" : "Ver seleção original"}</button>{aberto && <Conteudo {...props}/>}</section>;
}
function Conteudo({ userId, clienteId, composicaoId }: Props) {
  const q = useInfiniteQuery({ queryKey: ["backlog-historico-selecao", userId, clienteId, composicaoId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_historico_selecao_composicao", { p_composicao_id: composicaoId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; return z.array(evento).max(20).parse(data); },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.request_id : undefined });
  return <section><h4>Seleção original</h4><p>Registro do envio original; pode diferir das associações atuais. Seleções não enviadas não são registradas nesta fonte.</p>
    {q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {q.data && q.data.pages.flat().length === 0 && <p>Nenhum comando de seleção nesta fonte.</p>}
    {q.data && <ol>{q.data.pages.flat().map(e => <li key={e.request_id}>Solicitação {e.request_id} · ator {e.ator_id}<ul>{e.itens.map(i => <li key={i.id}>Pendência {i.id} · revisão selecionada {i.revision}</li>)}</ul></li>)}</ol>}
    {q.hasNextPage && <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Mais registros</button>}
  </section>;
}
