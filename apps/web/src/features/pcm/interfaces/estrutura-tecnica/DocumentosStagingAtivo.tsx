import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

type Props = {
  userId: string;
  clienteId: string;
  tipo: "grupo_quantitativo" | "sistema" | "componente";
  entidadeId: string;
};
async function conferirSessao(userId: string, signal?: AbortSignal) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
}
export function DocumentosStagingAtivo(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.tipo, props.entidadeId])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, tipo, entidadeId }: Props) {
  const ativo = import.meta.env.VITE_SSO_DOCUMENTOS_STAGING_ATIVO_ENABLED === "true";
  const q = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, tipo, entidadeId, "documentos-staging"],
    enabled: ativo,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_documentos_ativo_mediado", {
          p_tipo: tipo,
          p_entidade_id: entidadeId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              id: z.string().uuid(),
              titulo: z.string(),
              criado_em: z.string().datetime({ offset: true }),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      await conferirSessao(userId, signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p[p.length - 1]?.id : undefined),
  });
  if (!ativo) return null;
  return (
    <section aria-label="Documentos aceitos do levantamento">
      <h4>Documentos aceitos do levantamento</h4>
      <p>
        Vínculo temporário; aceite não comprova segurança do arquivo. Acesso depende da decisão e
        permissão atuais.
      </p>
      {(q.isPending || q.isFetching) && <output>Carregando…</output>}
      {q.isError && (
        <p role="alert">
          Documentos indisponíveis.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!q.isFetching &&
        !q.isError &&
        q.data?.pages
          .flat()
          .map((d) => <Documento key={d.id} userId={userId} vinculoId={d.id} titulo={d.titulo} />)}
      {q.hasNextPage && !q.isFetching && !q.isError && (
        <button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>
          Mais documentos
        </button>
      )}
    </section>
  );
}
function Documento({
  userId,
  vinculoId,
  titulo,
}: { userId: string; vinculoId: string; titulo: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [obtendo, setObtendo] = useState(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function preparar() {
    setObtendo(true);
    setErro(false);
    try {
      await conferirSessao(userId);
      if (!montado.current) return;
      const { data, error } = await supabase.functions.invoke(
        "pcm-documento-staging-ativo-seguro",
        { body: { vinculoId } },
      );
      if (
        error ||
        !(data instanceof Blob) ||
        data.type !== "application/pdf" ||
        data.size > 10485760
      )
        throw new Error("Documento inválido");
      await conferirSessao(userId);
      if (montado.current) setUrl(URL.createObjectURL(data));
    } catch {
      if (montado.current) setErro(true);
    } finally {
      if (montado.current) setObtendo(false);
    }
  }
  return (
    <div>
      {titulo} ·{" "}
      {url ? (
        <>
          <a href={url} download="documento.pdf">
            Baixar PDF
          </a>
          <button type="button" onClick={() => setUrl(null)}>
            Descartar cópia temporária
          </button>
        </>
      ) : (
        <button type="button" disabled={obtendo} onClick={() => void preparar()}>
          Preparar download
        </button>
      )}
      {erro && <p role="alert">Documento indisponível ou acesso não autorizado.</p>}
    </div>
  );
}
