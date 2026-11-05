import { supabase } from "../../../lib/supabase-client";
import type { IdentidadeSnapshotExportacao } from "../application/snapshot-exportacao";

export async function obterPaginaSnapshotExportacao(
  identidade: IdentidadeSnapshotExportacao,
  posicao: number,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!Number.isSafeInteger(posicao) || posicao < 0) throw new Error("Posição inválida.");
  const natureza = import.meta.env.VITE_SSO_NATUREZA_ALVO_ROTINA_ENABLED === "true";
  const usuario = natureza ? await supabase.auth.getUser() : null;
  if (natureza && (usuario?.error || !usuario?.data.user?.id || signal?.aborted))
    throw new Error("Sessão indisponível.");
  const atorId = usuario?.data.user?.id;
  let consulta = supabase
    .schema("pcm")
    .rpc(natureza ? "sso_snapshot_exportacao_natureza" : "sso_snapshot_exportacao_conferido", {
      ...(natureza ? { p_ator_id: atorId } : {}),
      p_cliente_id: identidade.clienteId,
      p_plano_id: identidade.planoId,
      p_versao_id: identidade.versaoId,
      p_posicao: posicao,
      p_limite: 100,
    });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  if (natureza) {
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== usuario?.data.user?.id || signal?.aborted)
      throw new Error("Sessão alterada.");
  }
  return data;
}
