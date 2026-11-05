import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const resposta = z
  .object({
    ciclo: z.number().int().nonnegative(),
    vencimentoOriginal: dataCivil,
    proximoCiclo: z.number().int().nonnegative().nullable(),
    proximoVencimento: dataCivil.nullable(),
    feriadoAtual: z.enum(["declarado_geral", "indeterminado"]),
    feriadoProximo: z.enum(["declarado_geral", "indeterminado"]),
    fonteFeriadosIncompleta: z.literal(true),
    execucaoAlteraAncora: z.literal(false),
    ocorrenciaCriada: z.literal(false),
  })
  .strict();

export function ProximoCicloAncorado({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  ciclo,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  ciclo: number;
}) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({
    queryKey: ["proximo-ciclo-ancorado", userId, clienteId, planoId, versaoId, rotinaId, ciclo],
    enabled: aberto,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_proximo_ciclo_ancorado", {
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: rotinaId,
          p_ciclo: ciclo,
        })
        .abortSignal(signal);
      if (error) throw error;
      const resultado = resposta.parse(data);
      if (
        resultado.ciclo !== ciclo ||
        (resultado.proximoCiclo === null) !== (resultado.proximoVencimento === null) ||
        (resultado.proximoCiclo !== null && resultado.proximoCiclo !== ciclo + 1)
      )
        throw new Error("Prévia divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return resultado;
    },
  });
  return (
    <section aria-label="Próximo ciclo ancorado">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {aberto ? "Ocultar próximo ciclo" : "Consultar próximo ciclo"}
      </button>
      {aberto && (
        <>
          <p>
            O próximo vencimento usa a âncora original mesmo após atraso. Feriados consultados são
            apenas declarações gerais do Cliente; a lista é incompleta e ausência não prova dia
            útil. Não gera nem reprograma ocorrência.
          </p>
          {consulta.isFetching && <output>Consultando próximo ciclo…</output>}
          {consulta.isError && (
            <p role="alert">
              Prévia indisponível.{" "}
              <button type="button" onClick={() => void consulta.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!consulta.isFetching && !consulta.isError && consulta.data && (
            <p>
              Original {consulta.data.vencimentoOriginal} · feriado{" "}
              {consulta.data.feriadoAtual === "declarado_geral" ? "declarado" : "não determinado"} ·
              próximo {consulta.data.proximoVencimento ?? "indeterminado nesta vigência"} · feriado
              próximo{" "}
              {consulta.data.feriadoProximo === "declarado_geral" ? "declarado" : "não determinado"}
            </p>
          )}
        </>
      )}
    </section>
  );
}
