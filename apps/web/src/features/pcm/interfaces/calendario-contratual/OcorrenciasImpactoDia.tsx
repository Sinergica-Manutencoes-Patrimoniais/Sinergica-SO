import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { HistoricoMovimentosOcorrencia } from "./HistoricoMovimentosOcorrencia";

const linha = z
  .object({
    ocorrencia_id: z.string().uuid(),
    plano_id: z.string().uuid(),
    rotina_id: z.string().uuid(),
    vencimento_original: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    possui_vinculo_legado: z.boolean(),
  })
  .strict();

export function OcorrenciasImpactoDia({
  userId,
  clienteId,
  serieId,
  visitaId,
}: {
  userId: string;
  clienteId: string;
  serieId: string;
  visitaId: string;
}) {
  const [historicoId, setHistoricoId] = useState<string | null>(null);
  const consulta = useInfiniteQuery({
    queryKey: ["calendario-impacto-ocorrencias", userId, clienteId, serieId, visitaId],
    retry: false,
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_ocorrencias_impacto_dia", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_serie_id: serieId,
          p_visita_id: visitaId,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(30).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const atual = item.ocorrencia_id.toLowerCase();
        if (anterior !== null && atual <= anterior) throw new Error("Página divergente.");
        anterior = atual;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 30 ? pagina.at(-1)?.ocorrencia_id : undefined),
  });
  return (
    <section aria-label="Ocorrências vinculadas à Visita">
      <p>
        Ocorrências preparadas vinculadas; não inclui todas as fontes legadas ou OS. Consulta não
        altera vencimentos.
      </p>
      {consulta.isFetching && <output>Consultando ocorrências…</output>}
      {consulta.isError && (
        <p role="alert">
          Ocorrências indisponíveis.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data && (
        <>
          {consulta.data.pages.flat().length === 0 ? (
            <p>Nenhuma ocorrência preparada encontrada.</p>
          ) : (
            <ul>
              {consulta.data.pages.flat().map((x) => (
                <li key={x.ocorrencia_id}>
                  Plano {x.plano_id} · Rotina {x.rotina_id} · vencimento {x.vencimento_original} ·
                  vínculo legado {x.possui_vinculo_legado ? "presente" : "não identificado"}
                  {import.meta.env.VITE_SSO_HISTORICO_MOVIMENTO_OCORRENCIA_ENABLED === "true" && (
                    <>
                      <button
                        type="button"
                        aria-expanded={historicoId === x.ocorrencia_id}
                        onClick={() =>
                          setHistoricoId(historicoId === x.ocorrencia_id ? null : x.ocorrencia_id)
                        }
                      >
                        Consultar mudanças de programação
                      </button>
                      {historicoId === x.ocorrencia_id && (
                        <HistoricoMovimentosOcorrencia
                          key={`${userId}:${clienteId}:${visitaId}:${x.ocorrencia_id}`}
                          userId={userId}
                          clienteId={clienteId}
                          visitaId={visitaId}
                          ocorrenciaId={x.ocorrencia_id}
                        />
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {consulta.hasNextPage && (
            <button type="button" onClick={() => void consulta.fetchNextPage()}>
              Mais ocorrências
            </button>
          )}
        </>
      )}
    </section>
  );
}
