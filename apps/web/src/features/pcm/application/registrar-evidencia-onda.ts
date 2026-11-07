import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const referencia = z.string().min(1).max(200).regex(/^[A-Za-z0-9_.:-]+$/);
export const pedidoEvidenciaSchema = z.object({
  requestId: z.string().guid(), clienteId: z.string().guid(), onda: z.number().int().min(1).max(6),
  expectedRevision: z.number().int().nonnegative(), cenario: z.string().regex(/^CT-(00[1-9]|0[12][0-9]|030)$/),
  versao: z.string().trim().min(1).max(120), ambiente: z.string().trim().min(1).max(120),
  executadoEm: z.string().datetime({ offset: true }), resultado: z.enum(["passou", "falhou", "bloqueado"]),
  identificadores: z.array(referencia).min(1).max(50), artefatos: z.array(referencia).min(1).max(50),
  ressalva: z.string().max(2000),
}).strict();
export type PedidoEvidencia = z.infer<typeof pedidoEvidenciaSchema>;

/** Declara evidência; não registra aceite e não autoriza operações externas. */
export async function registrarEvidenciaOnda(entrada: PedidoEvidencia) {
  const p = pedidoEvidenciaSchema.parse(entrada);
  const { data, error } = await supabase.schema("pcm").rpc("sso_registrar_evidencia_onda", {
    p_request_id: p.requestId, p_cliente_id: p.clienteId, p_onda: p.onda, p_expected_revision: p.expectedRevision,
    p_cenario: p.cenario, p_versao: p.versao, p_ambiente: p.ambiente, p_executado_em: p.executadoEm,
    p_resultado: p.resultado, p_identificadores: p.identificadores, p_artefatos: p.artefatos, p_ressalva: p.ressalva,
  });
  if (error) throw error;
  const resposta = z.object({ id: z.string().guid(), clienteId: z.string().guid(), onda: z.number().int(),
    revision: z.number().int().positive(), requestId: z.string().guid() }).strict().parse(data);
  if (resposta.clienteId !== p.clienteId || resposta.onda !== p.onda || resposta.requestId !== p.requestId || resposta.revision !== p.expectedRevision + 1) {
    throw new Error("Confirmação de evidência divergente.");
  }
  return resposta;
}
