import { supabase } from "../../../lib/supabase-client";
import type { EvolutionGateway } from "../application/evolution-gateway";
import type { EvolutionAcaoResultado, EvolutionInstancia } from "../domain/evolution";

interface EvolutionResponse {
  instancia?: EvolutionInstancia;
  instancias?: EvolutionInstancia[];
  qrCode?: string | null;
}

async function invocar(body: Record<string, unknown>): Promise<EvolutionResponse> {
  const { data, error } = await supabase.functions.invoke<EvolutionResponse>(
    "atendimento-evolution",
    { body },
  );
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const problema = (await context
        .clone()
        .json()
        .catch(() => null)) as {
        detail?: string;
      } | null;
      if (problema?.detail) throw new Error(problema.detail);
    }
    throw new Error(error.message || "Não foi possível acessar a Evolution API.");
  }
  return data ?? {};
}

function exigirInstancia(data: EvolutionResponse): EvolutionInstancia {
  if (!data.instancia) throw new Error("Resposta inválida da integração Evolution.");
  return data.instancia;
}

export const supabaseEvolutionAdapter: EvolutionGateway = {
  async listar() {
    const data = await invocar({ acao: "listar" });
    return data.instancias ?? [];
  },

  async criar(input) {
    const data = await invocar({ acao: "criar", ...input });
    return { instancia: exigirInstancia(data), qrCode: data.qrCode ?? null };
  },

  async conectar(id) {
    const data = await invocar({ acao: "conectar", id });
    return { instancia: exigirInstancia(data), qrCode: data.qrCode ?? null };
  },

  async desconectar(id) {
    return exigirInstancia(await invocar({ acao: "desconectar", id }));
  },
};
