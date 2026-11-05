import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { BreadcrumbGrupo } from "./BreadcrumbGrupo";
const linha = z
  .object({
    grupo_id: z.string().uuid(),
    grupo_nome: z.string(),
    quantidade: z.number().int().safe().positive(),
    local_nome: z.string().nullable(),
    area_nome: z.string().nullable(),
    sistema_nome: z.string().nullable(),
    local_estado: z.enum(["disponivel", "indisponivel"]),
    sistema_estado: z.enum(["disponivel", "indisponivel", "nao_vinculado"]),
  })
  .strict();
export function HierarquiaGrupos({ userId, clienteId }: { userId: string; clienteId: string }) {
  const ativo = import.meta.env.VITE_SSO_HIERARQUIA_GRUPOS_ENABLED === "true";
  const q = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, "hierarquia-grupos"],
    enabled: ativo,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_hierarquia_grupos_mediada", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(20).parse(data);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) =>
      pagina.length === 20 ? pagina[pagina.length - 1]?.grupo_id : undefined,
  });
  if (!ativo) return null;
  return (
    <section aria-label="Grupos e Sistemas">
      <h4>Grupos por posição e Sistema</h4>
      {(q.isPending || q.isFetching) && <output>Carregando…</output>}
      {q.isError && (
        <p role="alert">
          Não foi possível carregar a hierarquia.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!q.isFetching && !q.isError && q.data && (
        <>
          <ul>
            {q.data.pages.flat().map((g) => (
              <li key={g.grupo_id}>
                {g.grupo_nome} — {g.quantidade} unidades ·{" "}
                {g.local_estado === "disponivel"
                  ? `${g.area_nome} / ${g.local_nome}`
                  : "Local indisponível"}{" "}
                · Sistema:{" "}
                {g.sistema_estado === "nao_vinculado"
                  ? "não vinculado"
                  : g.sistema_estado === "disponivel"
                    ? g.sistema_nome
                    : "vínculo indisponível"}
                <BreadcrumbGrupo userId={userId} clienteId={clienteId} grupoId={g.grupo_id} />
              </li>
            ))}
          </ul>
          {q.data.pages.flat().length === 0 && <p>Nenhum Grupo disponível.</p>}
        </>
      )}
      {!q.isFetching && !q.isError && q.hasNextPage && (
        <button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>
          Carregar mais Grupos
        </button>
      )}
    </section>
  );
}
