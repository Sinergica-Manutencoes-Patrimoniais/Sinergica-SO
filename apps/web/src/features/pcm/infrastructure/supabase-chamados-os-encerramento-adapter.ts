import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const resultado = z.object({
  composicaoCompleta: z.boolean(),
  parcelas: z.number().int().safe().nonnegative(),
  parcelasPendentes: z.number().int().safe().nonnegative(),
  continuacoesPendentes: z.number().int().safe().nonnegative(),
  ordens: z.number().int().safe().nonnegative(),
  ordensNaoFinalizadas: z.number().int().safe().nonnegative(),
}).strict();

export const supabaseChamadosOsEncerramentoAdapter = {
  async avaliar(clienteId: string, chamadoId: string, signal?: AbortSignal) {
    let consulta = supabase.schema("pcm").rpc("sso_avaliar_encerramento_chamado", {
      p_cliente_id: clienteId, p_chamado_id: chamadoId,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return resultado.parse(data);
  },
};
