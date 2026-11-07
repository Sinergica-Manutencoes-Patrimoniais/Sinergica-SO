import { supabase } from "../../../lib/supabase-client";

/** Referências de espelho, não classificações ou Pendências oficiais. */
export async function listarReferenciasRetorno(
  clienteId: string,
  apos: string | null,
  signal?: AbortSignal,
) {
  let chamada = supabase
    .schema("pcm")
    .rpc("sso_listar_referencias_avaliacoes", {
      p_cliente_id: clienteId,
      p_apos: apos,
      p_limite: 20,
    });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Referências de retorno inválidas.");
  return data.map((row) => {
    if (
      typeof row.avaliacao_id !== "string" ||
      typeof row.ocorrencia_id !== "string" ||
      typeof row.vencimento !== "string" ||
      typeof row.recebido_em !== "string" ||
      (row.pergunta_referencia !== null && typeof row.pergunta_referencia !== "string")
    )
      throw new Error("Referência de retorno inválida.");
    return {
      id: row.avaliacao_id as string,
      ocorrenciaId: row.ocorrencia_id as string,
      vencimento: row.vencimento as string,
      pergunta: row.pergunta_referencia as string | null,
      recebidoEm: row.recebido_em as string,
    };
  });
}
