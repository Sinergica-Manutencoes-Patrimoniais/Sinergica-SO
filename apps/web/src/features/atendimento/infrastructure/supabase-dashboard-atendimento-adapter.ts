import { supabase } from "../../../lib/supabase-client";
import type { DashboardAtendimentoGateway } from "../application/dashboard-atendimento-gateway";

async function contarMensagensSaida(remetenteTipo: "ze" | "humano" | "agente"): Promise<number> {
  const { count, error } = await supabase
    .schema("atendimento")
    .from("mensagens")
    .select("id", { count: "exact", head: true })
    .eq("direcao", "saida")
    .eq("remetente_tipo", remetenteTipo);
  if (error) throw error;
  return count ?? 0;
}

export const supabaseDashboardAtendimentoAdapter: DashboardAtendimentoGateway = {
  async contarAutonomiaIa() {
    // E02-S08: "autonomia da IA" soma qualquer agente (Zé + agente comercial), contra humano —
    // o campo continua se chamando `ze` no domínio (AutonomiaIa) por não valer a pena renomear só
    // por isso, mas semanticamente é "qualquer IA" a partir desta story.
    const [ze, agente, humano] = await Promise.all([
      contarMensagensSaida("ze"),
      contarMensagensSaida("agente"),
      contarMensagensSaida("humano"),
    ]);
    return { ze: ze + agente, humano };
  },
};
