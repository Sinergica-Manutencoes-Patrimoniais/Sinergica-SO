/** E01-S147: KPI leve do Atendimento pro card da tela Início — mesmo snapshot RPC
 * (`atendimento.fn_metrics_snapshot`) que `AtendimentoDashboardPage` já usa, período "hoje" (o
 * card é uma foto do agora, não um relatório). */
import { useQuery } from "@tanstack/react-query";
import { montarPainelAtendimento } from "../domain/dashboard-atendimento";
import type { DashboardAtendimentoGateway } from "./dashboard-atendimento-gateway";
import { obterPainelAtendimento } from "./obter-painel-atendimento";

export const resumoInicioQueryKeys = {
  atendimento: () => ["atendimento", "resumo-inicio"] as const,
};

export function useAtendimentoResumoInicio(
  gateway: DashboardAtendimentoGateway,
  habilitado = true,
) {
  return useQuery({
    queryKey: resumoInicioQueryKeys.atendimento(),
    queryFn: async () => montarPainelAtendimento(await obterPainelAtendimento(gateway, "hoje")),
    enabled: habilitado,
  });
}
