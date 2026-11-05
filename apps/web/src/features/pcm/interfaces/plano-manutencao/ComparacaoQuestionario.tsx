import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { z } from "zod";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

export function ComparacaoQuestionario({
  userId,
  clienteId,
  planoId,
  revisao,
  rotinaId,
}: { userId: string; clienteId: string; planoId: string; revisao: number; rotinaId: string }) {
  const habilitado = import.meta.env.VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED === "true";
  const consulta = useQuery({
    queryKey: ["comparacao-questionario-revisao", userId, clienteId, planoId, revisao, rotinaId],
    enabled: habilitado,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_comparar_questionario_mediado", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_revisao: revisao,
          p_rotina_logica_id: rotinaId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          revisao: z.number().int().positive(),
          rotinaLogicaId: z.string().uuid(),
          estadoComparacao: z.enum([
            "nao_comparavel",
            "sem_questionario",
            "referencia_alterada",
            "historico_indeterminado",
            "fonte_atual_indisponivel",
            "conteudo_integral_igual",
            "conteudo_integral_diferente",
          ]),
          impactoOperacionalCalculado: z.literal(false),
          aprovacaoAutorizada: z.literal(false),
        })
        .passthrough()
        .parse(data);
      if (r.revisao !== revisao || r.rotinaLogicaId.toLowerCase() !== rotinaId.toLowerCase())
        throw new Error("Comparação divergente.");
      await conferirSessaoDiagnostico(userId, signal);
      return r;
    },
  });
  const descricoes: Record<string, string> = {
    nao_comparavel: "Indeterminado: Rotina ausente em uma versão.",
    sem_questionario: "Nenhuma referência de questionário nas duas versões.",
    referencia_alterada: "A referência de questionário mudou; conteúdo não comparado.",
    historico_indeterminado: "Indeterminado: estrutura histórica incompleta ou desconhecida.",
    fonte_atual_indisponivel: "Indeterminado: fonte atual indisponível ou incompleta.",
    conteudo_integral_igual: "JSON integral igual à fonte atual neste instante.",
    conteudo_integral_diferente:
      "JSON integral diferente da fonte atual; a diferença pode ser somente metadado.",
  };
  return (
    <section aria-label="Comparação de questionário">
      <h5>Questionário histórico e atual</h5>
      {!habilitado && <p>Comparação mediada indisponível.</p>}
      <p>
        O histórico aprovado é preservado; a fonte atual pode mudar. Comparação não calcula impacto
        nem autoriza aprovação.
      </p>
      {consulta.isFetching && <p role="status">Verificando acesso e comparação…</p>}
      {consulta.isError && (
        <p role="alert">
          Comparação indisponível.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data && (
        <p>{descricoes[consulta.data.estadoComparacao] ?? "Indeterminado: estado desconhecido."}</p>
      )}
    </section>
  );
}
