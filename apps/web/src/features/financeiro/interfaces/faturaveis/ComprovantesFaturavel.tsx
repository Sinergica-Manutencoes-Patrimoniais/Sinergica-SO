import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({ id: z.string().uuid(), revisao: z.number().int().positive(), criado_em: z.string() }).strict();
export function ComprovantesFaturavel({ usuario, cliente, itemId }: { usuario: string; cliente: string; itemId: string }) {
  const [aberto, setAberto] = useState(false); const [revisao, setRevisao] = useState(""); const cache = useQueryClient();
  const chave = ["comprovantes-faturavel", usuario, cliente, itemId];
  const lista = useInfiniteQuery({ queryKey: chave, enabled: aberto, gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true,
    initialPageParam: null as string | null, queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.schema("financeiro").rpc("sso_listar_comprovantes_faturavel", { p_cliente_id: cliente, p_item_id: itemId, p_apos: pageParam }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(20).parse(data);
    }, getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined });
  const vincular = useMutation({ mutationFn: async () => {
    if (!/^\d+$/.test(revisao) || !Number.isSafeInteger(Number(revisao)) || Number(revisao)<1) throw new Error("Revisão inválida");
    const { error } = await supabase.schema("financeiro").rpc("sso_vincular_comprovante_faturavel", { p_item_id: itemId, p_revisao: Number(revisao) });
    if (error) throw error;
  }, onSuccess: () => cache.invalidateQueries({ queryKey: chave }) });
  const baixar = useMutation({ mutationFn: async (id: string) => {
    const { data, error } = await supabase.functions.invoke<Blob>("faturavel-comprovante-seguro", { body: { lancamentoId: id } });
    if (error) throw error; if (!(data instanceof Blob)) throw new Error("Resposta inválida");
    const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = "comprovante"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } });
  if (import.meta.env.VITE_SSO_ANEXOS_FATURAVEIS_ENABLED !== "true") return null;
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar comprovantes" : "Comprovantes vinculados"}</button>
    {aberto && <><p>Somente comprovantes da despesa que originou este candidato; não são compartilhados no Portal.</p>
      <form onSubmit={(e) => { e.preventDefault(); vincular.mutate(); }}><label>Revisão do comprovante <input required inputMode="numeric" value={revisao} onChange={(e) => setRevisao(e.target.value)} /></label>
        <button type="submit" disabled={vincular.isPending}>Vincular comprovante existente</button></form>
      {vincular.isError && <p role="alert">Não foi possível vincular; confira revisão e acesso.</p>}
      {lista.isFetching && <p>Consultando comprovantes…</p>}{lista.isError && <p role="alert">Comprovantes indisponíveis. <button type="button" onClick={() => void lista.refetch()}>Tentar novamente</button></p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().length === 0 && <p>Nenhum comprovante vinculado.</p>}
      {!lista.isFetching && !lista.isError && lista.data?.pages.flat().map((a) => <p key={a.id}>Revisão {a.revisao} · {new Date(a.criado_em).toLocaleString("pt-BR")} <button type="button" disabled={baixar.isPending} onClick={() => baixar.mutate(a.id)}>Baixar</button></p>)}
      {!lista.isError && lista.hasNextPage && <button type="button" onClick={() => void lista.fetchNextPage()}>Mais comprovantes</button>}
      {baixar.isError && <p role="alert">Arquivo indisponível ou sem acesso.</p>}</>}
  </section>;
}
