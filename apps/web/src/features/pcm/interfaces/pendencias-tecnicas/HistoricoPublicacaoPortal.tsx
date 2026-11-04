import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({ id: z.string().uuid(), revisao: z.number().int().positive(), alvo: z.string(), descricao: z.string(),
  estado: z.enum(["aberta", "risco_aceito", "dispensada", "duplicada", "resolvida"]), publicado_em: z.string(), revogado_em: z.string().nullable() }).strict();
export function HistoricoPublicacaoPortal({ userId, clienteId, pendenciaId, revisao }: { userId: string; clienteId: string; pendenciaId: string; revisao: number }) {
  const [aberto, setAberto] = useState(false);
  const chave = ["pcm-publicacoes-pendencia", userId, clienteId, pendenciaId];
  const lista = useInfiniteQuery({ queryKey: chave, enabled: aberto, gcTime: 0, staleTime: 0, retry: false,
    refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_publicacoes_pendencia_mediada", {
        p_ator_id: userId, p_cliente_id: clienteId, p_pendencia_id: pendenciaId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(item).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? ""; for (const p of pagina) { if (p.id.toLowerCase() <= anterior) throw new Error("Página divergente."); anterior = p.id.toLowerCase(); } const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return pagina;
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const publicacoes = lista.data?.pages.flat() ?? []; const consistentes = publicacoes.every((p,i) => i === 0 || publicacoes[i-1]!.id.toLowerCase() < p.id.toLowerCase());
  return <section aria-label="Publicações da pendência">
    <button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar publicações" : "Ver publicações ao Cliente"}</button>
    {aberto && lista.isFetching && <p>Consultando publicações…</p>}
    {aberto && lista.isError && <p role="alert">Histórico indisponível ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {aberto && !consistentes && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void lista.refetch()}>Reconsultar</button></p>}
    {aberto && !lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhuma publicação registrada.</p>}
    {aberto && !lista.isFetching && !lista.isError && consistentes && publicacoes.map((p) => <article key={p.id}>
      <p>Revisão {p.revisao} · {p.revisao === revisao ? "revisão atual" : "revisão anterior"} · {p.revogado_em ? "revogada" : "não revogada"}</p>
      <p>{p.alvo} — {p.descricao} · {p.estado}</p>
      <p>Publicada em {new Date(p.publicado_em).toLocaleString("pt-BR")}{p.revogado_em && ` · Revogada em ${new Date(p.revogado_em).toLocaleString("pt-BR")}`}</p>
      {!p.revogado_em && <Revogar id={p.id} chave={chave} userId={userId} clienteId={clienteId} />}
    </article>)}
    {aberto && !lista.isError && lista.hasNextPage && <button type="button" disabled={lista.isFetching} onClick={() => void lista.fetchNextPage()}>Mais publicações</button>}
  </section>;
}
function Revogar({ id, chave, userId, clienteId }: { id: string; chave: string[]; userId: string; clienteId: string }) {
  const [motivo, setMotivo] = useState(""); const [confirmacao, setConfirmacao] = useState<string | null>(null); const cache = useQueryClient(); const fotografia = JSON.stringify([userId, clienteId, id, motivo.trim()]);
  const acao = useMutation({ mutationFn: async () => {
    const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
    const { error } = await supabase.schema("pcm").rpc("sso_revogar_pendencia_portal_mediada", { p_ator_id: userId, p_cliente_id: clienteId, p_publicacao_id: id, p_motivo: motivo.trim() });
    if (error) throw error; const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
  }, onSuccess: () => cache.invalidateQueries({ queryKey: chave }) });
  return <form onSubmit={(e) => { e.preventDefault(); if (motivo.trim() && confirmacao === fotografia && !acao.isPending) acao.mutate(); }}>
    <label>Motivo da revogação <input required maxLength={1000} value={motivo} disabled={acao.isPending} onChange={(e) => setMotivo(e.target.value)} /></label>
    <label><input type="checkbox" checked={confirmacao === fotografia} onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)} /> Confirmo a retirada desta publicação.</label>
    <button type="submit" disabled={acao.isPending || !motivo.trim() || confirmacao !== fotografia}>Revogar publicação</button>
    {acao.isError && <p role="alert">Resultado não confirmado. Consulte o histórico antes de tentar novamente.</p>}
  </form>;
}
