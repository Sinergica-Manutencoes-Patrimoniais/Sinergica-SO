import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const ordensSchema = z.array(
  z
    .object({
      id: z.string().uuid(),
      numero: z.string(),
      titulo: z.string(),
      status: z.string(),
    })
    .strict(),
);

// Consulta ligada ao painel e quadro sob flag; exige rollout coordenado e validação de acesso.
export const supabaseChamadosOsLeituraAdapter = {
  async listar(
    clienteId: string,
    chamadoId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    const funcao = import.meta.env.VITE_SSO_LEITURA_OS_CHAMADO_SEGURA_ENABLED === "true"
      ? "sso_listar_ordens_chamado_segura" : "sso_listar_ordens_chamado";
    let consulta = supabase.schema("pcm").rpc(funcao, {
      p_cliente_id: clienteId,
      p_chamado_id: chamadoId,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    const ordens = ordensSchema.parse(data);
    if (ordens.length > limite) throw new Error("Página de Ordens de Serviço inválida.");
    let anterior = apos?.toLowerCase() ?? null;
    for (const ordem of ordens) {
      const atual = ordem.id.toLowerCase();
      if (anterior !== null && atual <= anterior)
        throw new Error("Página de Ordens de Serviço inválida.");
      anterior = atual;
    }
    return ordens;
  },
};
