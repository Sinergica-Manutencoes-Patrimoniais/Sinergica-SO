import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { conferirSessaoCobranca } from "../infrastructure/supabase-portal-cobrancas-os-adapter";

const item = z.object({ id: z.string().uuid(), publicacao_anexo_id: z.string().uuid(), titulo: z.string() }).strict();
export function DocumentosCobranca({ userId, clienteId, osId, lancamentoId }: { userId: string; clienteId: string; osId: string; lancamentoId: string }) {
  const contexto = JSON.stringify([userId, clienteId, osId, lancamentoId]);
  const contextoAtual = useRef(contexto);
  contextoAtual.current = contexto;
  const ativo = useRef(true);
  const geracao = useRef(0);
  const baixando = useRef(false);
  useLayoutEffect(() => { ativo.current = true; geracao.current++; return () => { ativo.current = false; geracao.current++; }; }, [contexto]);
  const lista = useInfiniteQuery({ queryKey: ["portal-documentos-cobranca", userId, clienteId, osId, lancamentoId], gcTime: 0,
    staleTime: 0, retry: false, refetchOnWindowFocus: true, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => { await conferirSessaoCobranca(userId, signal); const { data, error } = await supabase.schema("financeiro").rpc("sso_portal_documentos_cobranca", {
      p_cliente_id: clienteId, p_os_id: osId, p_lancamento_id: lancamentoId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; const pagina = z.array(item).max(20).parse(data); let anterior = pageParam?.toLowerCase() ?? null;
      for (const registro of pagina) { const id = registro.id.toLowerCase(); if (anterior !== null && id <= anterior) throw new Error("Página inválida."); anterior = id; } await conferirSessaoCobranca(userId, signal); return pagina; }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const baixar = useMutation({ mutationFn: async (id: string) => {
    if (baixando.current) throw new Error("Download em andamento.");
    baixando.current = true;
    const contextoSolicitado = contexto;
    const geracaoSolicitada = geracao.current;
    try {
    await conferirSessaoCobranca(userId);
    const { data, error } = await supabase.functions.invoke<Blob>("portal-anexo-os-seguro", { body: { lancamentoId: id } });
    if (error) throw error; if (!(data instanceof Blob)) throw new Error("Resposta inválida");
    await conferirSessaoCobranca(userId);
    if (!ativo.current || contextoAtual.current !== contextoSolicitado || geracao.current !== geracaoSolicitada) return;
    const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = "documento-cobranca"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally { baixando.current = false; }
  } });
  const documentos = lista.data?.pages.flat() ?? [];
  const divergentes = documentos.some((item, i) => i > 0 && item.id.toLowerCase() <= documentos[i - 1]!.id.toLowerCase());
  return <section aria-label="Documentos da cobrança"><h4>Documentos da cobrança</h4>
    {lista.isFetching && <p>Consultando documentos…</p>}{lista.isError && <p role="alert">Documentos indisponíveis ou sem acesso. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
    {!lista.isFetching && !lista.isError && divergentes && <p role="alert">As páginas de documentos divergiram. <button type="button" onClick={() => void lista.refetch()}>Consultar novamente</button></p>}
    {!lista.isFetching && !lista.isError && !divergentes && lista.data && documentos.length === 0 && <p>Nenhum documento publicado.</p>}
    {!lista.isFetching && !lista.isError && !divergentes && documentos.map((a) => <p key={a.id}>{a.titulo} <button type="button" disabled={baixar.isPending} onClick={() => baixar.mutate(a.publicacao_anexo_id)}>Baixar</button></p>)}
    {!lista.isError && !divergentes && lista.hasNextPage && <button type="button" disabled={lista.isFetching} onClick={() => { if (!lista.isFetching) void lista.fetchNextPage(); }}>Mais documentos</button>}
    {baixar.isError && <p role="alert">Arquivo indisponível ou sem acesso.</p>}
  </section>;
}
