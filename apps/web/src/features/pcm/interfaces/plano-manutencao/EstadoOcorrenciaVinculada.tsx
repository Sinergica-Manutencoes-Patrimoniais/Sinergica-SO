import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resposta = z.discriminatedUnion("motivo", [
  z
    .object({
      preparadaId: z.string().uuid(),
      estado: z.literal("indeterminado"),
      motivo: z.literal("sem_vinculo"),
      completude: z.literal("parcial"),
    })
    .strict(),
  z
    .object({
      preparadaId: z.string().uuid(),
      estado: z.literal("indeterminado"),
      motivo: z.literal("vinculo_divergente"),
      completude: z.literal("parcial"),
    })
    .strict(),
  z
    .object({
      preparadaId: z.string().uuid(),
      estado: z.enum(["indeterminado", "resultado_registrado", "candidata_aguardando"]),
      motivo: z.literal("fonte_legada"),
      resultadoPreventivo: z.enum(["pendente", "ok", "nao_ok"]),
      ordensAtivas: z.number().int().nonnegative().safe(),
      ordensFinalizadas: z.number().int().nonnegative().safe(),
      completude: z.literal("parcial"),
    })
    .strict(),
]);

export function EstadoOcorrenciaVinculada({
  userId,
  clienteId,
  planoId,
  preparadaId,
}: { userId: string; clienteId: string; planoId: string; preparadaId: string }) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({
    queryKey: ["estado-ocorrencia-vinculada", userId, clienteId, planoId, preparadaId],
    enabled: aberto,
    gcTime: 0,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_estado_ocorrencia_vinculada", {
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_preparada_id: preparadaId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = resposta.parse(data);
      if (
        r.preparadaId !== preparadaId ||
        (r.motivo === "fonte_legada" && r.ordensFinalizadas > r.ordensAtivas)
      )
        throw new Error("Resposta divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return r;
    },
  });
  const estado = !consulta.isFetching && !consulta.isError ? consulta.data : undefined;
  return (
    <section aria-label="Estado da ocorrência vinculada">
      <p>Ocorrência preparada {preparadaId}</p>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar estado" : "Conferir estado da fonte vinculada"}
      </button>
      {aberto && (
        <>
          <p>Consulta parcial; não comprova execução externa ou completude da fila.</p>
          {consulta.isFetching && <output>Consultando estado…</output>}
          {consulta.isError && (
            <p role="alert">
              Estado indisponível.{" "}
              <button type="button" onClick={() => void consulta.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {estado?.motivo === "sem_vinculo" && (
            <p>Estado indeterminado: não há vínculo preventivo comprovado.</p>
          )}
          {estado?.motivo === "vinculo_divergente" && (
            <p>Estado indeterminado: o vínculo requer reconciliação.</p>
          )}
          {estado?.motivo === "fonte_legada" && (
            <p>
              {estado.estado === "resultado_registrado"
                ? "Resultado registrado na fonte preventiva"
                : estado.estado === "candidata_aguardando"
                  ? "Candidata aguardando conferência PCM"
                  : "Estado indeterminado"}{" "}
              · resultado {estado.resultadoPreventivo} · OS ativas {estado.ordensAtivas} · OS
              finalizadas {estado.ordensFinalizadas}.
            </p>
          )}
          {estado?.motivo === "fonte_legada" && estado.estado === "indeterminado" && (
            <p>
              Confira vínculos explícitos, versões e situação da OS; a consulta não identifica
              sozinha a causa da divergência.
            </p>
          )}
        </>
      )}
    </section>
  );
}
