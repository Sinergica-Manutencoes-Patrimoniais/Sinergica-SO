import { supabase } from "../../../lib/supabase-client";
import type {
  SincronizacaoAuvoRun,
  SincronizarAuvoGateway,
} from "../application/sincronizar-auvo-gateway";

interface AuvoSyncRunRow {
  id: string;
  status: "running" | "succeeded" | "failed";
  ok: boolean | null;
  results: Array<{ step: string; ok: boolean; error?: string }> | null;
  started_at: string;
  finished_at: string | null;
}

function paraRun(row: AuvoSyncRunRow): SincronizacaoAuvoRun {
  return {
    id: row.id,
    status: row.status,
    ok: row.ok,
    etapas: (row.results ?? []).map((r) => ({ step: r.step, ok: r.ok, error: r.error })),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export const supabaseSincronizarAuvoAdapter: SincronizarAuvoGateway = {
  async iniciar(): Promise<{ runId: string }> {
    const { data, error } = await supabase.functions.invoke("pcm-auvo-sync-all", {
      method: "POST",
    });
    if (error) throw error;
    const resultado = data as { runId: string; status: string };
    return { runId: resultado.runId };
  },

  async consultarRun(runId: string): Promise<SincronizacaoAuvoRun> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("auvo_sync_runs")
      .select("id, status, ok, results, started_at, finished_at")
      .eq("id", runId)
      .single();
    if (error) throw error;
    return paraRun(data as AuvoSyncRunRow);
  },

  async buscarUltimaRun(): Promise<SincronizacaoAuvoRun | null> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("auvo_sync_runs")
      .select("id, status, ok, results, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? paraRun(data as AuvoSyncRunRow) : null;
  },
};
