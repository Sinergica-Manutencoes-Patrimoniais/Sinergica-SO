import { supabase } from "../../../lib/supabase-client";
import type { ResumoChamadoCard } from "../domain/progresso-chamado";

/** Cada requisição cobre no máximo 100 Chamados; nunca calcula sobre páginas do feed. */
export async function carregarResumosChamados(
  ids: string[],
  signal: AbortSignal,
): Promise<Record<string, ResumoChamadoCard>> {
  const resultado: Record<string, ResumoChamadoCard> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("sso_resumir_chamados_lote", { p_ids: lote })
      .abortSignal(signal);
    if (error || !Array.isArray(data)) throw error ?? new Error("Resumo indisponível");
    for (const row of data) {
      if (
        ![row.total, row.finalizadas].every(
          (v) => typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)),
        )
      )
        throw new Error("Resumo inválido");
      const total = Number(row.total);
      const finalizadas = Number(row.finalizadas);
      if (
        typeof row.chamado_id !== "string" ||
        !lote.includes(row.chamado_id) ||
        resultado[row.chamado_id] ||
        !Number.isSafeInteger(total) ||
        !Number.isSafeInteger(finalizadas) ||
        total < 1 ||
        finalizadas < 0 ||
        finalizadas > total ||
        typeof row.etapas_mistas !== "boolean"
      ) {
        throw new Error("Resumo inválido");
      }
      resultado[row.chamado_id] = { total, finalizadas, etapasMistas: row.etapas_mistas };
    }
  }
  return resultado;
}
