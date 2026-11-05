import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { TriagemCicloAtrasado } from "../plano-manutencao/TriagemCicloAtrasado";

const linha = z
  .object({
    ocorrencia_id: z.string().uuid(),
    plano_id: z.string().uuid(),
    rotina_id: z.string().uuid(),
    vencimento_original: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    escopo: z.enum(["declaracao_geral", "verificar_contrato"]),
  })
  .strict();
type Props = { userId: string; clienteId: string; feriadoId: string; data: string };
function TriagemDaRotina({
  userId,
  clienteId,
  planoId,
  rotinaId,
  ocorrenciaId,
}: { userId: string; clienteId: string; planoId: string; rotinaId: string; ocorrenciaId: string }) {
  const [aberta, setAberta] = useState(false);
  if (import.meta.env.VITE_SSO_TRIAGEM_CICLO_ATRASADO_ENABLED !== "true") return null;
  return (
    <>
      <button type="button" aria-expanded={aberta} onClick={() => setAberta((v) => !v)}>
        {aberta ? "Ocultar triagem da Rotina" : "Abrir triagem da Rotina"}
      </button>
      {aberta && (
        <>
          <p>
            A triagem apresenta candidatos conforme data de referência e tolerância; esta
            coincidência pode não aparecer se ainda não atender aos critérios.
          </p>
          <TriagemCicloAtrasado
            userId={userId}
            clienteId={clienteId}
            planoId={planoId}
            rotinaId={rotinaId}
            ocorrenciaEmConferencia={ocorrenciaId}
          />
        </>
      )}
    </>
  );
}
export function CoincidenciasCalendario(props: Props) {
  const [aberto, setAberto] = useState(false);
  if (import.meta.env.VITE_SSO_COINCIDENCIAS_CALENDARIO_FERIADO_ENABLED !== "true") return null;
  return (
    <>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar vencimentos" : "Consultar vencimentos por calendário"}
      </button>
      {aberto && (
        <Conteudo
          key={JSON.stringify([props.userId, props.clienteId, props.feriadoId, props.data])}
          {...props}
        />
      )}
    </>
  );
}
function Conteudo({ userId, clienteId, feriadoId, data }: Props) {
  const q = useInfiniteQuery({
    queryKey: ["coincidencias-calendario-feriado", userId, clienteId, feriadoId, data],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data: resposta, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_coincidencias_calendario_feriado", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_feriado_id: feriadoId,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(30).parse(resposta);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const item of pagina) {
        const id = item.ocorrencia_id.toLowerCase();
        if ((anterior !== null && id <= anterior) || item.vencimento_original !== data)
          throw new Error("Página inconsistente.");
        anterior = id;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 30 ? p[p.length - 1]?.ocorrencia_id : undefined),
  });
  return (
    <section aria-label="Vencimentos por calendário em feriado">
      <p>
        O vencimento original permanece inalterado. Confira a situação e trate eventuais pendências
        no PCM; a lista não comprova execução.
      </p>
      {q.isFetching && <output>Consultando vencimentos…</output>}
      {q.isError && (
        <p role="alert">
          Consulta indisponível.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!q.isFetching && !q.isError && q.data && (
        <>
          {q.data.pages.flat().length === 0 ? (
            <p>Nenhuma coincidência encontrada nesta fonte.</p>
          ) : (
            <ul>
              {q.data.pages.flat().map((o) => (
                <li key={o.ocorrencia_id}>
                  Ocorrência {o.ocorrencia_id} · Plano {o.plano_id} · Rotina {o.rotina_id} ·{" "}
                  {o.vencimento_original}
                  {o.escopo === "verificar_contrato"
                    ? " · conferir aplicabilidade do contrato"
                    : " · declaração geral"}
                  <TriagemDaRotina
                    userId={userId}
                    clienteId={clienteId}
                    planoId={o.plano_id}
                    rotinaId={o.rotina_id}
                    ocorrenciaId={o.ocorrencia_id}
                  />
                </li>
              ))}
            </ul>
          )}
          {q.hasNextPage && (
            <button type="button" onClick={() => void q.fetchNextPage()}>
              Mais vencimentos
            </button>
          )}
        </>
      )}
    </section>
  );
}
