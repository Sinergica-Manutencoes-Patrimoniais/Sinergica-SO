import { supabase } from "../../../lib/supabase-client";
import type { DashboardAtendimentoGateway } from "../application/dashboard-atendimento-gateway";
import type { PeriodoDashboard, SnapshotAtendimentoRaw } from "../domain/dashboard-atendimento";

export const supabaseDashboardAtendimentoAdapter: DashboardAtendimentoGateway = {
  async obterSnapshot(periodo: PeriodoDashboard): Promise<SnapshotAtendimentoRaw> {
    const { data, error } = await supabase.functions.invoke("atendimento-metrics", {
      body: { periodo },
    });
    if (error) throw error;
    return data as SnapshotAtendimentoRaw;
  },
};
