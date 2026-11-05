import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; grupoId: string };
export function FotosStagingGrupo(props: Props) {
  if (import.meta.env.VITE_SSO_FOTOS_STAGING_GRUPO_ENABLED !== "true") return null;
  return <Lista key={JSON.stringify([props.userId, props.clienteId, props.grupoId])} {...props} />;
}
function Lista({ userId, clienteId, grupoId }: Props) {
  const q = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, grupoId, "fotos-staging"],
    gcTime: 0, initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const mediado = import.meta.env.VITE_SSO_LISTAR_FOTOS_GRUPO_MEDIADO_ENABLED === "true";
      const { data, error } = await supabase.schema("pcm").rpc(mediado ? "sso_listar_fotos_staging_grupo_mediado" : "sso_listar_fotos_staging_grupo", {
        ...(mediado ? { p_ator_id: userId, p_cliente_id: clienteId } : {}), p_grupo_id: grupoId, p_apos: pageParam, p_limite: 20,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(z.object({ id: z.string().uuid(), criado_em: z.string().datetime({ offset: true }) }).strict()).max(20).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined,
  });
  const itens = q.data?.pages.flat() ?? [];
  const duplicados = new Set(itens.map((item) => item.id.toLowerCase())).size !== itens.length;
  return <section aria-label="Fotos aceitas do levantamento">
    <h5>Fotos aceitas do levantamento</h5><p>O acesso depende da decisão mais recente e da permissão atual.</p>
    {q.isFetching && <output>Carregando…</output>}
    {q.isError && <p role="alert">Fotos indisponíveis. <button type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>}
    {!q.isFetching && !q.isError && duplicados && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void q.refetch()}>Consultar novamente</button></p>}
    {!q.isFetching && !q.isError && !duplicados && <>
      {itens.map((f) => <Foto key={f.id} userId={userId} vinculoId={f.id} />)}
      {q.hasNextPage && <button type="button" onClick={() => void q.fetchNextPage()}>Mais fotos</button>}
    </>}
  </section>;
}
function Foto({ userId, vinculoId }: { userId: string; vinculoId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const geracao = useRef(0);
  useEffect(() => () => { geracao.current++; }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function abrir() {
    const atual = ++geracao.current;
    setAbrindo(true); setErro(false);
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || geracao.current !== atual) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.functions.invoke("pcm-foto-staging-grupo-segura", { body: { vinculoId } });
      if (error || !(data instanceof Blob) || !["image/jpeg", "image/png"].includes(data.type) || data.size > 10_485_760) throw new Error("Foto inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || geracao.current !== atual) throw new Error("Sessão alterada.");
      setUrl(URL.createObjectURL(data));
    } catch { if (geracao.current === atual) setErro(true); }
    finally { if (geracao.current === atual) setAbrindo(false); }
  }
  return <div>{url ? <><img src={url} alt="Foto aceita do levantamento" /><button type="button" onClick={() => setUrl(null)}>Ocultar foto</button></>
    : <button type="button" disabled={abrindo} onClick={() => void abrir()}>Ver foto</button>}
    {erro && <p role="alert">Foto indisponível ou acesso não autorizado.</p>}
  </div>;
}
