import { supabase } from "../../../lib/supabase-client";
import type { GastoLogItem, ModuloIa } from "../domain/ia-gasto";

interface GastoLogRow {
  id: string;
  modulo: ModuloIa;
  usd_cost: number;
  modelo: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  ref_id: string | null;
  endpoint: string | null;
  created_at: string;
}

const COLS =
  "id,modulo,usd_cost,modelo,prompt_tokens,completion_tokens,ref_id,endpoint,created_at" as const;

function mapRow(row: GastoLogRow): GastoLogItem {
  return {
    id: row.id,
    modulo: row.modulo,
    usdCost: Number(row.usd_cost),
    modelo: row.modelo,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    refId: row.ref_id,
    endpoint: row.endpoint,
    createdAt: row.created_at,
  };
}

export interface IaGastoGateway {
  /** E02-S31 AC-1: logs do mês (`mesRef` — qualquer data dentro do mês desejado), pro cálculo de
   * `resumoGastoMes`/`verificarQuotaExcedida` no domínio. */
  listarLogsDoMes(mesRef: Date): Promise<GastoLogItem[]>;
  /** E02-S31 AC-3: histórico recente, opcionalmente filtrado por módulo. */
  listarHistorico(params: { modulo?: ModuloIa; limite?: number }): Promise<GastoLogItem[]>;
  /** E02-S33 AC-1: custo de uma mensagem específica (`ref_id`), se houver. */
  buscarCustoPorRefIds(refIds: string[]): Promise<Map<string, GastoLogItem>>;
}

export const supabaseIaAdapter: IaGastoGateway = {
  async listarLogsDoMes(mesRef: Date): Promise<GastoLogItem[]> {
    const inicio = new Date(Date.UTC(mesRef.getUTCFullYear(), mesRef.getUTCMonth(), 1));
    const fim = new Date(Date.UTC(mesRef.getUTCFullYear(), mesRef.getUTCMonth() + 1, 1));
    const { data, error } = await supabase
      .schema("config")
      .from("ia_gasto_log")
      .select(COLS)
      .gte("created_at", inicio.toISOString())
      .lt("created_at", fim.toISOString());
    if (error) throw error;
    return ((data ?? []) as GastoLogRow[]).map(mapRow);
  },

  async listarHistorico(params): Promise<GastoLogItem[]> {
    let query = supabase
      .schema("config")
      .from("ia_gasto_log")
      .select(COLS)
      .order("created_at", { ascending: false })
      .limit(params.limite ?? 50);
    if (params.modulo) query = query.eq("modulo", params.modulo);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as GastoLogRow[]).map(mapRow);
  },

  async buscarCustoPorRefIds(refIds: string[]): Promise<Map<string, GastoLogItem>> {
    if (refIds.length === 0) return new Map();
    const { data, error } = await supabase
      .schema("config")
      .from("ia_gasto_log")
      .select(COLS)
      .in("ref_id", refIds);
    if (error) throw error;
    const mapa = new Map<string, GastoLogItem>();
    for (const row of (data ?? []) as GastoLogRow[]) {
      if (row.ref_id) mapa.set(row.ref_id, mapRow(row));
    }
    return mapa;
  },
};
