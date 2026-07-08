import type { PeriodoDashboard, SnapshotAtendimentoRaw } from "../domain/dashboard-atendimento";

export interface DashboardAtendimentoGateway {
  obterSnapshot(periodo: PeriodoDashboard): Promise<SnapshotAtendimentoRaw>;
}
