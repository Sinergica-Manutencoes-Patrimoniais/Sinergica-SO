import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = { userId: string; clienteId: string; loteId: string; chave: string };
const linha = z.object({ posicao: z.number().int().positive().max(10000), referencia: z.string().min(1).max(200) }).strict();

export function ReferenciasCampo(props: Props) {
  const [aberto, setAberto] = useState(false);
  if (import.meta.env.VITE_SSO_REFERENCIAS_FOTO_CAMPO_ENABLED !== "true") return null;
  return <section>
    <button type="button" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>{aberto ? "Ocultar referências declaradas" : "Consultar referências declaradas de fotos"}</button>
    {aberto && <Lista key={JSON.stringify([props.userId, props.clienteId, props.loteId, props.chave])} {...props} />}
  </section>;
}

function Lista({ userId, clienteId, loteId, chave }: Props) {
  const consulta = useInfiniteQuery({
    queryKey: ["referencias-foto-campo", userId, clienteId, loteId, chave], gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc(
        import.meta.env.VITE_SSO_REFERENCIAS_FOTO_CAMPO_MEDIADAS_ENABLED === "true"
          ? "sso_listar_referencias_foto_campo_mediado" : "sso_listar_referencias_foto_campo", {
        p_ator_id: userId, p_cliente_id: clienteId, p_lote_id: loteId, p_chave: chave, p_apos: pageParam, p_limite: 30,
      }).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(30).parse(data);
      let anterior = pageParam ?? 0;
      for (const item of pagina) { if (item.posicao <= anterior) throw new Error("Página inconsistente."); anterior = item.posicao; }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => pagina.length === 30 ? pagina[pagina.length - 1]?.posicao : undefined,
  });
  const itens = consulta.data?.pages.flat() ?? [];
  const paginasDivergentes = itens.some((item, indice) => indice > 0 && item.posicao <= itens[indice - 1]!.posicao);
  return <div>
    <p>Referências informadas manualmente: não comprovam origem, existência da foto ou vínculo validado. Nenhuma imagem é baixada aqui.</p>
    {consulta.isFetching && <output>Consultando referências…</output>}
    {consulta.isError && <p role="alert">Referências indisponíveis. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && paginasDivergentes && <p role="alert">As páginas de referências divergiram. Atualize antes de conferir. <button type="button" onClick={() => void consulta.refetch()}>Atualizar</button></p>}
    {!consulta.isFetching && !consulta.isError && !paginasDivergentes && consulta.data && <>
      {itens.length === 0 ? <p>Nenhuma referência declarada nesta linha.</p> : <ul>{itens.map((item) => <li key={item.posicao}>{item.referencia}</li>)}</ul>}
      {consulta.hasNextPage && <button type="button" onClick={() => void consulta.fetchNextPage()}>Mais referências</button>}
    </>}
  </div>;
}
