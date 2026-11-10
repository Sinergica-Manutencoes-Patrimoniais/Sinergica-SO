import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { listarReferenciasRetorno } from "../../infrastructure/supabase-pendencias-tecnicas-adapter";

export function ReferenciasRetorno({ userId, clienteId }: { userId: string; clienteId: string }) {
  const chave = ["referencias-retorno", userId, clienteId] as const;
  const permissao = useQuery({
    queryKey: [...chave, "permissao"],
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("execucao.validar", clienteId),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const lista = useInfiniteQuery({
    queryKey: [...chave, "lista"],
    enabled: permitido,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listarReferenciasRetorno(clienteId, pageParam, signal),
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso aos retornos…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  return (
    <section aria-label="Referências de retornos preventivos">
      <h2>Referências de retornos preventivos</h2>
      <p>
        Espelho recebido: isto não é uma lista de Pendências, não comprova validação PCM nem
        classifica respostas.
      </p>
      {lista.isFetching && <output>Carregando referências…</output>}
      {lista.isError && (
        <p role="alert">
          Não foi possível carregar referências.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!lista.isFetching && !lista.isError && (
        <>
          {lista.data?.pages.flat().length === 0 && <p>Nenhum retorno encontrado.</p>}
          <ul>
            {lista.data?.pages.flat().map((r) => (
              <li key={r.id}>
                Ocorrência {r.ocorrenciaId} · vencimento {r.vencimento} · referência:{" "}
                {r.pergunta ?? "não informada"} · recebido {r.recebidoEm}
              </li>
            ))}
          </ul>
          {lista.hasNextPage && (
            <button type="button" onClick={() => void lista.fetchNextPage()}>
              Mais referências
            </button>
          )}
        </>
      )}
    </section>
  );
}
