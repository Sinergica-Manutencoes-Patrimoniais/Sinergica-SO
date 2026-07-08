import type { PeriodoDashboard } from "../domain/dashboard-atendimento";
import type { DashboardAtendimentoGateway } from "./dashboard-atendimento-gateway";

export async function obterPainelAtendimento(
  gateway: DashboardAtendimentoGateway,
  periodo: PeriodoDashboard,
) {
  return gateway.obterSnapshot(periodo);
}
