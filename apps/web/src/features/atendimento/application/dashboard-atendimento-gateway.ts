import type { AutonomiaIa } from "../domain/dashboard-atendimento";

export interface DashboardAtendimentoGateway {
  contarAutonomiaIa(): Promise<AutonomiaIa>;
}
