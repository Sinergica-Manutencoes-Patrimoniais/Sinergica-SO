import type { CursorCronograma } from "../application/fonte-cronograma-fotografia";
import { supabase } from "../../../lib/supabase-client";
type Consulta = { clienteId: string; planoId: string; versaoId: string; inicio: string; fim: string };
export async function obterPaginaCronograma(consulta: Consulta, apos: CursorCronograma | null, signal?: AbortSignal): Promise<unknown> {
  let query = supabase.schema("pcm").rpc("sso_ocorrencias_cronograma_conferidas", {
    p_cliente_id: consulta.clienteId, p_plano_id: consulta.planoId, p_versao_id: consulta.versaoId,
    p_inicio: consulta.inicio, p_fim: consulta.fim, p_apos_tipo: apos?.tipo ?? null, p_apos_id: apos?.id ?? null, p_limite: 100,
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Página de ocorrências inválida.");
  return data.map((r: Record<string, unknown>) => ({ tipo: r.tipo, id: r.id, clienteId: r.cliente_id, planoId: r.plano_id, versaoId: r.versao_id, rotinaId: r.rotina_id, alvoId: r.alvo_id, vencimentoOriginal: r.vencimento_original, dataProgramada: r.data_programada, visitaEstado: r.visita_estado, visitaRevisao: r.visita_revisao, snapshotHash: r.snapshot_hash, completude: r.completude }));
}
