import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";

export function PreviaEvidenciasResposta({
  userId,
  clienteId,
  retornoId,
}: { userId: string; clienteId: string; retornoId: string }) {
  const q = useInfiniteQuery({
    queryKey: ["retorno-previa-evidencias-respostas", userId, clienteId, retornoId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_prever_evidencias_resposta_mediada", {
          p_cliente_id: clienteId,
          p_retorno_id: retornoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Prévia inválida.");
      return data as {
        resposta_id: string;
        chave_pergunta: string;
        resultado: string;
        evidencias_declaradas: number | string;
        estado: string;
        evidencia_autenticada: boolean;
      }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.resposta_id : undefined),
  });
  return (
    <section aria-label="Prévia de evidência por resposta">
      <h4>Prévia de evidências por resposta</h4>
      <p>
        Mostra apenas respostas registradas. Associação declarada não autentica anexo nem comprova
        execução; perguntas sem resposta exigem conferência do snapshot.
      </p>
      {q.isFetching && <p>Consultando…</p>}
      {q.isError && (
        <p role="alert">
          Prévia indisponível.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {q.data && !q.isError && (
        <ul>
          {q.data.pages.flat().map((r) => (
            <li key={r.resposta_id}>
              Pergunta {r.chave_pergunta} · {r.resultado} · {String(r.evidencias_declaradas)}{" "}
              associação(ões) declarada(s) · {r.estado} · evidência autenticada não comprovada
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage && (
        <button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>
          Mais respostas
        </button>
      )}
    </section>
  );
}
