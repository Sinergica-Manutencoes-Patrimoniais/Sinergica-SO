import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { PropostaPmoc } from "./PropostaPmoc";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  inicio: string;
  fim: string;
  revision?: number;
};
export function DiagnosticoPmoc(props: Props) {
  if (import.meta.env.VITE_SSO_PMOC_MEDIADO_ENABLED !== "true")
    return <p>Conferência PMOC indisponível.</p>;
  return (
    <DiagnosticoPmocAtivo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.versaoId,
        props.rotinaId,
        props.inicio,
        props.fim,
      ])}
      {...props}
    />
  );
}
function DiagnosticoPmocAtivo({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  inicio,
  fim,
  revision,
}: Props) {
  const q = useInfiniteQuery({
    queryKey: ["diagnostico-pmoc", userId, clienteId, planoId, versaoId, rotinaId, inicio, fim],
    gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_diagnosticar_pmoc_mediado", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: rotinaId,
          p_inicio: inicio,
          p_fim: fim,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              ciclo: z.number().int().nonnegative().safe(),
              vencimento: z.string().date(),
              agendamentos_pmoc_mesma_data: z.union([
                z.number().int().nonnegative().safe(),
                z.string().regex(/^(0|[1-9][0-9]*)$/),
              ]),
              diagnostico: z.literal("alvo_nao_correlacionado_conflito_indeterminado"),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      let anterior = pageParam ?? -1;
      for (const item of pagina) {
        if (item.ciclo <= anterior || item.vencimento < inicio || item.vencimento > fim)
          throw new Error("Página divergente.");
        anterior = item.ciclo;
      }
      await conferirSessaoDiagnostico(userId, signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.ciclo : undefined),
  });
  return (
    <section aria-label="Concomitância com PMOC">
      <h4>Conferência indicativa com PMOC</h4>
      <p>
        Mesma data não prova duplicidade ou mesmo alvo; ausência de coincidência não elimina
        conflito. O PMOC legado é agrupado por imóvel e contrato; nenhuma OS ou agenda será
        modificada.
      </p>
      {q.isFetching && <p>Consultando…</p>}
      {q.isError && (
        <p role="alert">
          Diagnóstico indisponível.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {q.data && !q.isFetching && !q.isError && (
        <ul>
          {q.data.pages.flat().map((r) => (
            <li key={r.ciclo}>
              Ciclo {r.ciclo} · {r.vencimento}: {String(r.agendamentos_pmoc_mesma_data)}{" "}
              agendamento(s) PMOC na mesma data; alvo não correlacionado.
              {import.meta.env.VITE_SSO_PROPOSTA_PMOC_ENABLED === "true" &&
                revision !== undefined &&
                Number(r.agendamentos_pmoc_mesma_data) > 0 && (
                  <PropostaPmoc
                    userId={userId}
                    clienteId={clienteId}
                    planoId={planoId}
                    versaoId={versaoId}
                    rotinaId={rotinaId}
                    revision={revision}
                    vencimento={r.vencimento}
                  />
                )}
            </li>
          ))}
        </ul>
      )}
      {q.hasNextPage && (
        <button type="button" disabled={q.isFetching} onClick={() => void q.fetchNextPage()}>
          Mais ciclos
        </button>
      )}
    </section>
  );
}
