import { supabase } from "../../../lib/supabase-client";
import type {
  SincronizacaoAuvoResultado,
  SincronizarAuvoGateway,
} from "../application/sincronizar-auvo-gateway";

export const supabaseSincronizarAuvoAdapter: SincronizarAuvoGateway = {
  async sincronizar(): Promise<SincronizacaoAuvoResultado> {
    const { data, error } = await supabase.functions.invoke("pcm-auvo-sync-all", {
      method: "POST",
    });
    if (error) throw error;
    const resultado = data as {
      ok: boolean;
      syncedAt: string;
      results: Array<{ step: string; ok: boolean; error?: string }>;
    };
    return {
      ok: resultado.ok,
      syncedAt: resultado.syncedAt,
      etapas: resultado.results.map((r) => ({ step: r.step, ok: r.ok, error: r.error })),
    };
  },
};
