import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const linha = z
  .object({
    request_id: z.string().uuid(),
    serie_id: z.string().uuid(),
    regra_id: z.string().uuid(),
    semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    data_contratual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    criado_em: z.string().datetime({ offset: true }),
  })
  .strict();

type Props = { userId: string; clienteId: string; feriadoId: string; data: string };

export function HistoricoSupressaoGerador(props: Props) {
  const [aberto, setAberto] = useState(false);
  if (import.meta.env.VITE_SSO_HISTORICO_SUPRESSAO_GERADOR_ENABLED !== "true") return null;
  return (
    <>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((atual) => !atual)}>
        {aberto ? "Ocultar histórico do gerador" : "Consultar histórico do gerador"}
      </button>
      {aberto && (
        <Lista
          key={JSON.stringify([props.userId, props.clienteId, props.feriadoId, props.data])}
          {...props}
        />
      )}
    </>
  );
}

function Lista({ userId, clienteId, feriadoId, data }: Props) {
  const consulta = useInfiniteQuery({
    queryKey: ["historico-supressao-gerador", userId, clienteId, feriadoId, data],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const resposta = await supabase
        .schema("pcm")
        .rpc("sso_listar_supressoes_gerador_feriado", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_feriado_id: feriadoId,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (resposta.error) throw resposta.error;
      const pagina = z.array(linha).max(30).parse(resposta.data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const id = item.request_id.toLowerCase();
        if ((anterior !== null && id <= anterior) || item.data_contratual !== data)
          throw new Error("Página inconsistente.");
        anterior = id;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) =>
      pagina.length === 30 ? pagina[pagina.length - 1]?.request_id : undefined,
  });
  return (
    <section aria-label="Histórico de supressões do gerador">
      <p>
        Coincidências de data e contrato não comprovam que esta declaração causou a supressão. A
        consulta usa a regra disponível atualmente e pode não refletir o histórico completo.
      </p>
      {consulta.isFetching && <output>Consultando histórico…</output>}
      {consulta.isError && (
        <p role="alert">
          Consulta indisponível.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data && (
        <>
          {consulta.data.pages.flat().length === 0 ? (
            <p>Nenhuma coincidência encontrada nas páginas consultadas.</p>
          ) : (
            <ul>
              {consulta.data.pages.flat().map((item) => (
                <li key={item.request_id}>
                  Semana {item.semana} · data {item.data_contratual} · série {item.serie_id} · regra{" "}
                  {item.regra_id} · registro {item.criado_em}
                </li>
              ))}
            </ul>
          )}
          {consulta.hasNextPage && (
            <button type="button" onClick={() => void consulta.fetchNextPage()}>
              Mais registros
            </button>
          )}
        </>
      )}
    </section>
  );
}
