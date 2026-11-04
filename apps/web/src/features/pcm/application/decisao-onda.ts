import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

export const pedidoDecisaoOndaSchema = z.object({
  requestId: z.string().uuid(), clienteId: z.string().uuid(), onda: z.number().int().min(1).max(6),
  revision: z.number().int().nonnegative(), versao: z.string().trim().min(1).max(120),
  ambiente: z.string().trim().min(1).max(120),
  referencias: z.record(z.string().regex(/^[a-z_]+$/), z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/)),
  ressalva: z.string().max(2000),
}).strict();
export type PedidoDecisaoOnda = z.infer<typeof pedidoDecisaoOndaSchema>;

/** Registra somente declaração funcional; não autoriza produção ou execução externa. */
export async function registrarDecisaoOnda(ator: string, entrada: PedidoDecisaoOnda) {
  const p = pedidoDecisaoOndaSchema.parse(entrada);
  const antes = await supabase.auth.getUser();
  if (antes.error || antes.data.user?.id !== ator) throw new Error("Sessão alterada; decisão não enviada.");
  const { data, error } = await supabase.schema("pcm").rpc("sso_registrar_decisao_onda", {
    p_request_id: p.requestId, p_cliente_id: p.clienteId, p_onda: p.onda, p_revision: p.revision,
    p_versao: p.versao, p_ambiente: p.ambiente, p_referencias: p.referencias, p_ressalva: p.ressalva,
  });
  if (error) throw error;
  const resposta = z.object({ id: z.string().uuid(), requestId: z.string().uuid(), clienteId: z.string().uuid(),
    onda: z.number().int(), revision: z.number().int().nonnegative() }).strict().parse(data);
  const depois = await supabase.auth.getUser();
  if (depois.error || depois.data.user?.id !== ator || resposta.requestId !== p.requestId || resposta.clienteId !== p.clienteId ||
    resposta.onda !== p.onda || resposta.revision !== p.revision) throw new Error("Resultado não confirmado para esta sessão.");
  return resposta;
}
