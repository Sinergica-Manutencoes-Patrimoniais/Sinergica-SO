import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({ vinculo_id: z.string().guid(), titulo: z.string(), criado_em: z.string(), retirado_em: z.string().nullable(), motivo: z.string().nullable() }).strict();
export function HistoricoDocumentoCobranca({ usuario, cliente, lancamento }: { usuario: string; cliente: string; lancamento: string }) {
  const [aberto, setAberto] = useState(false); const [motivos, setMotivos] = useState<Record<string, string>>({}); const cache = useQueryClient();
  const chave = ["historico-documentos-cobranca", usuario, cliente, lancamento];
  const lista = useInfiniteQuery({ queryKey: chave, enabled: aberto, gcTime: 0, staleTime: 0, retry: false, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("financeiro").rpc("sso_historico_documentos_cobranca", {
      p_cliente_id: cliente, p_lancamento_id: lancamento, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data); }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.vinculo_id : undefined });
  const retirar = useMutation({ mutationFn: async (p: { id: string; motivo: string }) => {
    const { error } = await supabase.schema("financeiro").rpc("sso_retira_documento_cobranca", { p_vinculo_id: p.id, p_motivo: p.motivo }); if (error) throw error;
  }, onSuccess: () => cache.invalidateQueries({ queryKey: chave }) });
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar histórico" : "Histórico e retirada de documentos"}</button>
    {aberto && <><p>Retirar da cobrança não revoga a publicação independente do arquivo na OS.</p>
      {lista.isFetching && <p>Consultando histórico…</p>}{lista.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhum vínculo registrado.</p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().map((v) => <article key={v.vinculo_id}>
        <p>{v.titulo} · vinculado em {new Date(v.criado_em).toLocaleString("pt-BR")} · {v.retirado_em ? `retirado em ${new Date(v.retirado_em).toLocaleString("pt-BR")}` : "não retirado"}</p>
        {v.motivo && <p>Motivo: {v.motivo}</p>}
        {!v.retirado_em && <form onSubmit={(e) => { e.preventDefault(); const motivo = (motivos[v.vinculo_id] ?? "").trim(); if (motivo) retirar.mutate({ id: v.vinculo_id, motivo }); }}>
          <label>Motivo <input required maxLength={1000} value={motivos[v.vinculo_id] ?? ""} onChange={(e) => setMotivos((m) => ({ ...m, [v.vinculo_id]: e.target.value }))} /></label>
          <button type="submit" disabled={retirar.isPending}>Retirar da cobrança</button>
        </form>}
      </article>)}
      {!lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais vínculos</button>}
      {retirar.isError && <p role="alert">Não foi possível retirar o documento. Confira acesso e tente novamente.</p>}</>}
  </section>;
}
