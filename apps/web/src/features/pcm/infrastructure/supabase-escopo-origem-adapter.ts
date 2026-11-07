import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const retorno = z.object({
  osId: z.string(),
  revision: z.number().int().nonnegative(),
  executadoDeclarado: z.string().nullable(),
  restanteDeclarado: z.string().nullable(),
  execucaoComprovada: z.literal(false),
  origem: z.object({ preparadaId: z.string().min(1) }).passthrough(),
});
export type Escopo = z.infer<typeof retorno>;
export type PedidoEscopo = {
  requestId: string;
  clienteId: string;
  osId: string;
  revision: number;
  executado: string | null;
  restante: string | null;
  justificativa: string;
};
export async function consultarEscopo(
  clienteId: string,
  osId: string,
  signal: AbortSignal,
): Promise<Escopo> {
  const { data, error } = await supabase
    .schema("pcm")
    .rpc("sso_consultar_escopo_autorizado", { p_cliente_id: clienteId, p_os_id: osId })
    .abortSignal(signal);
  if (error) throw error;
  const parsed = retorno.parse(data);
  if (parsed.osId !== osId) throw new Error("Origem divergente.");
  return parsed;
}
export async function declararEscopo(p: PedidoEscopo): Promise<void> {
  const { data, error } = await supabase
    .schema("pcm")
    .rpc("sso_mediar_escopo_origem", {
      p_request_id: p.requestId,
      p_cliente_id: p.clienteId,
      p_os_id: p.osId,
      p_expected_revision: p.revision,
      p_executado: p.executado,
      p_restante: p.restante,
      p_justificativa: p.justificativa,
    });
  if (error) throw error;
  z.object({
    requestId: z.literal(p.requestId),
    revision: z.literal(p.revision + 1),
    execucaoComprovada: z.literal(false),
  }).parse(data);
}
