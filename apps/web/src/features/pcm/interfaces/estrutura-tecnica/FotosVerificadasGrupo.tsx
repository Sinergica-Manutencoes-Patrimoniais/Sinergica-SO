import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; grupoId: string };
export function FotosVerificadasGrupo(props: Props) {
  if (import.meta.env.VITE_SSO_FOTOS_VERIFICADAS_GRUPO_ENABLED !== "true") return null;
  return <Lista key={JSON.stringify([props.userId, props.clienteId, props.grupoId])} {...props} />;
}
function Lista({ userId, clienteId, grupoId }: Props) {
  const consulta = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, grupoId, "fotos-verificadas"], gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_listar_fotos_verificadas_grupo", { p_ator_id: userId, p_cliente_id: clienteId, p_grupo_id: grupoId, p_apos: pageParam, p_limite: 20 }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(z.object({ id: z.string().uuid(), criado_em: z.string().datetime({ offset: true }) }).strict()).max(20).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina.at(-1)?.id : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  const divergente = itens.some((item, indice) => indice > 0 && item.id.toLowerCase() <= itens[indice - 1]!.id.toLowerCase());
  return <section aria-label="Fotos verificadas do Grupo">
    <h5>Fotos verificadas do Grupo</h5><p>O acesso depende da decisão e da permissão atuais.</p>
    {consulta.isFetching && <output>Carregando…</output>}
    {consulta.isError && <p role="alert">Fotos indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && divergente && <p role="alert">Páginas divergentes. <button type="button" onClick={() => void consulta.refetch()}>Consultar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && !divergente && <>
      {itens.map((item) => <Foto key={item.id} userId={userId} vinculoId={item.id} />)}
      {consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais fotos</button>}
    </>}
  </section>;
}
function Foto({ userId, vinculoId }: { userId: string; vinculoId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false); const [abrindo, setAbrindo] = useState(false);
  const geracao = useRef(0);
  useEffect(() => () => { geracao.current++; }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function abrir() {
    const atual = ++geracao.current; setAbrindo(true); setErro(false);
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || geracao.current !== atual) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.functions.invoke<Blob>("pcm-foto-verificada-grupo-segura", { body: {}, headers: { "x-foto-id": vinculoId } });
      if (error || !(data instanceof Blob) || !["image/jpeg", "image/png"].includes(data.type) || data.size === 0 || data.size > 10_485_760) throw new Error("Foto inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || geracao.current !== atual) throw new Error("Sessão alterada.");
      setUrl(URL.createObjectURL(data));
    } catch { if (geracao.current === atual) setErro(true); }
    finally { if (geracao.current === atual) setAbrindo(false); }
  }
  return <div>{url ? <><img src={url} alt="Foto do Grupo com integridade verificada" /><button type="button" onClick={() => setUrl(null)}>Ocultar foto verificada</button></> : <button type="button" disabled={abrindo} onClick={() => void abrir()}>Ver foto com verificação</button>}{erro && <p role="alert">Foto verificada indisponível ou acesso não autorizado.</p>}</div>;
}
