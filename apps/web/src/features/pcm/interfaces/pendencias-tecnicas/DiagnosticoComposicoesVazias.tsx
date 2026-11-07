import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z.object({ composicao_id: z.string().guid(), chamado_id: z.string().guid(), revisao: z.number().int().positive(), retiradas_registradas: z.number().int().nonnegative(), parcelas_vinculadas: z.number().int().nonnegative() }).strict();
const evento = z.object({ id: z.string().guid(), pendencia_id: z.string().guid(), revisao_origem: z.number().int().positive(), revisao_composicao: z.number().int().positive(), motivo: z.string(), ator_id: z.string().guid(), criado_em: z.string().datetime({ offset: true }), decisao_excepcional: z.boolean() }).strict();
type Props = { userId: string; clienteId: string };
export function DiagnosticoComposicoesVazias(props: Props) {
  if (import.meta.env.VITE_SSO_DIAGNOSTICO_COMPOSICAO_VAZIA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}
function Conteudo({ userId, clienteId }: Props) {
  const [selecionada, setSelecionada] = useState("");
  const lista = useInfiniteQuery({ queryKey: ["backlog-diagnostico-vazias", userId, clienteId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_listar_composicoes_vazias_vinculadas", { p_cliente_id: clienteId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; return z.array(linha).max(20).parse(data); },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.composicao_id : undefined });
  return <section><h3>Composições vazias vinculadas</h3><p>Diagnóstico somente leitura. O histórico conhecido não comprova toda a causa; nenhuma composição ou Chamado será alterado.</p>
    {lista.isPending && <output>Consultando…</output>}{lista.isError && <p role="alert">Diagnóstico indisponível. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {lista.data && lista.data.pages.flat().length === 0 && <p>Nenhuma composição vazia vinculada nesta consulta.</p>}
    {lista.data && <ul>{lista.data.pages.flat().map(item => <li key={item.composicao_id}>Composição {item.composicao_id} · Chamado {item.chamado_id} · revisão {item.revisao} · {item.retiradas_registradas} retirada(s) registrada(s) · {item.parcelas_vinculadas} parcela(s) vinculada(s). <button type="button" onClick={() => setSelecionada(item.composicao_id)}>Ver histórico</button></li>)}</ul>}
    {lista.hasNextPage && <button type="button" disabled={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>Mais composições</button>}
    {selecionada && <Historico key={selecionada} userId={userId} clienteId={clienteId} composicaoId={selecionada} />}
  </section>;
}
function Historico({ userId, clienteId, composicaoId }: Props & { composicaoId: string }) {
  const q = useInfiniteQuery({ queryKey: ["backlog-diagnostico-vazias", userId, clienteId, composicaoId], gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").rpc("sso_historico_composicao_vazia_vinculada", { p_composicao_id: composicaoId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal); if (error) throw error; return z.array(evento).max(20).parse(data); },
    getNextPageParam: p => p.length === 20 ? p.at(-1)?.id : undefined });
  return <section><h4>Retiradas registradas · {composicaoId}</h4>{q.isPending && <output>Consultando…</output>}{q.isError && <p role="alert">Histórico indisponível ou composição alterada. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {q.data && q.data.pages.flat().length === 0 && <p>Não há retirada registrada nesta fonte; causa desconhecida.</p>}
    {q.data && <ol>{q.data.pages.flat().map(e => <li key={e.id}>Pendência {e.pendencia_id} · revisão {e.revisao_composicao} · {e.motivo} · {e.ator_id} · {e.decisao_excepcional ? "decisão excepcional registrada" : "sem decisão excepcional nesta fonte"} · <time dateTime={e.criado_em}>{new Date(e.criado_em).toLocaleString("pt-BR")}</time></li>)}</ol>}
    {q.hasNextPage && <button type="button" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Mais registros</button>}
  </section>;
}
