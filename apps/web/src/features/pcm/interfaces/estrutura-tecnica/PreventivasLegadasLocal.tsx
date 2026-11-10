import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z
  .object({
    id: z.string().guid(),
    nome: z.string(),
    estado: z.enum(["rascunho", "ativo", "pausado"]),
    primeira_data: z.string(),
    intervalo_n: z.number().int().positive(),
    intervalo_unidade: z.enum(["semanas", "meses"]),
  })
  .strict();
type Props = { userId: string; clienteId: string; localId: string; itemId: string };
export function PreventivasLegadasLocal(props: Props) {
  if (import.meta.env.VITE_SSO_PREVENTIVAS_LEGADAS_LOCAL_ENABLED !== "true") return null;
  return (
    <Abrir
      key={JSON.stringify([props.userId, props.clienteId, props.localId, props.itemId])}
      {...props}
    />
  );
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar preventivas legadas" : "Ver preventivas legadas"}
      </button>
      {aberto && <Lista {...props} />}
    </section>
  );
}
function Lista({ userId, clienteId, localId, itemId }: Props) {
  const q = useInfiniteQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, localId, itemId, "preventivas-legadas"],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const conferir = async () => {
        const s = await supabase.auth.getUser();
        if (s.error || s.data.user?.id !== userId || signal.aborted)
          throw new Error("Sessão alterada.");
      };
      await conferir();
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_local_ativo_preventivas_legadas", {
          p_ator: userId,
          p_cliente: clienteId,
          p_local: localId,
          p_ativo: itemId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const r of pagina) {
        const atual = r.id.toLowerCase();
        if (atual <= anterior) throw new Error("Página divergente.");
        anterior = atual;
      }
      await conferir();
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const dados = q.data?.pages.flat() ?? [];
  const divergentes = dados.some((r, i) => {
    if (i === 0) return false;
    const anterior = dados[i - 1];
    return !anterior || r.id.toLowerCase() <= anterior.id.toLowerCase();
  });
  return (
    <section aria-label="Preventivas legadas">
      <p>
        Fonte legada vinculada diretamente ao item. Não inclui Planos novos, ocorrências, nem
        garante execução; páginas não formam retrato transacional.
      </p>
      {q.isFetching && <output>Carregando preventivas…</output>}
      {(q.isError || divergentes) && (
        <p role="alert">
          Preventivas indisponíveis ou páginas divergentes.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!q.isFetching && !q.isError && !divergentes && q.data && (
        <>
          {dados.length === 0 ? (
            <p>Nenhuma preventiva legada vinculada visível nesta fonte.</p>
          ) : (
            <ul>
              {dados.map((r) => (
                <li key={r.id}>
                  {r.nome} · {r.estado} · primeira data {r.primeira_data} · a cada {r.intervalo_n}{" "}
                  {r.intervalo_unidade}
                </li>
              ))}
            </ul>
          )}
          {q.hasNextPage && (
            <button type="button" onClick={() => void q.fetchNextPage()}>
              Mais preventivas
            </button>
          )}
        </>
      )}
    </section>
  );
}
