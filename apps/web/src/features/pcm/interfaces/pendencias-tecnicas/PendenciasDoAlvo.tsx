import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z
  .object({
    id: z.string().guid(),
    alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
    alvo_id: z.string().guid(),
    alvo_nome: z.string().nullable(),
    pergunta: z.string(),
    observacao: z.string().nullable(),
    estado: z.enum(["aberta", "risco_aceito", "dispensada", "duplicada", "resolvida"]),
    revisao: z.number().int().positive(),
    criado_em: z.string().datetime({ offset: true }),
  })
  .strict();
type Props = {
  userId: string;
  clienteId: string;
  tipo: "sistema" | "componente" | "grupo";
  id: string;
};

/** A fonte existente pesquisa literalmente; a comparação exata impede misturar alvos. */
export function PendenciasDoAlvo(props: Props) {
  if (
    import.meta.env.VITE_SSO_PENDENCIAS_TECNICAS_ENABLED !== "true" ||
    import.meta.env.VITE_SSO_PENDENCIAS_FILTRO_ATIVO_ENABLED !== "true"
  )
    return null;
  return (
    <Abrir key={JSON.stringify([props.userId, props.clienteId, props.tipo, props.id])} {...props} />
  );
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar Pendências" : "Ver Pendências deste ativo"}
      </button>
      {aberto && <Lista {...props} />}
    </section>
  );
}
function Lista({ userId, clienteId, tipo, id }: Props) {
  const q = useInfiniteQuery({
    queryKey: ["pendencias-tecnicas", userId, clienteId, "por-alvo", tipo, id],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const conferir = async () => {
        const sessao = await supabase.auth.getUser();
        if (sessao.error || sessao.data.user?.id !== userId || signal.aborted)
          throw new Error("Sessão alterada.");
      };
      await conferir();
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_pendencias_por_ativo", {
          p_cliente_id: clienteId,
          p_busca: id,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of pagina) {
        const atual = item.id.toLowerCase();
        if (atual <= anterior) throw new Error("Página divergente.");
        anterior = atual;
      }
      await conferir();
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const registros = q.data?.pages.flat() ?? [];
  const divergentes = registros.some((r, i) => {
    if (i === 0) return false;
    const anterior = registros[i - 1];
    return !anterior || r.id.toLowerCase() <= anterior.id.toLowerCase();
  });
  const itens = registros.filter(
    (p) => p.alvo_tipo === tipo && p.alvo_id.toLowerCase() === id.toLowerCase(),
  );
  return (
    <section aria-label="Pendências do ativo">
      <p>
        Fonte parcial: somente Pendências registradas no novo fluxo, sujeitas à permissão de
        validação. Não inclui histórico anterior.
      </p>
      {q.isFetching && <output>Carregando Pendências…</output>}
      {(q.isError || divergentes) && (
        <p role="alert">
          Pendências indisponíveis ou páginas divergentes.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!q.isFetching && !q.isError && !divergentes && q.data && (
        <>
          {itens.length === 0 ? (
            <p>
              Nenhuma Pendência deste ativo nas páginas carregadas
              {q.hasNextPage ? "; há mais páginas" : ""}.
            </p>
          ) : (
            <ul>
              {itens.map((p) => (
                <li key={p.id}>
                  {p.pergunta} · {p.estado}
                  {p.observacao && <> · {p.observacao}</>}
                </li>
              ))}
            </ul>
          )}
          {q.hasNextPage && (
            <button type="button" onClick={() => void q.fetchNextPage()}>
              Mais Pendências
            </button>
          )}
        </>
      )}
    </section>
  );
}
