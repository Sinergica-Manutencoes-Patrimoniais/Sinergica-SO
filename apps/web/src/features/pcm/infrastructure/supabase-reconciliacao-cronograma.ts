import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const uuid = z.string().guid();
const linha = z.object({ id: uuid, fonte_id: z.string().min(1).max(200), revisao: z.number().int().positive().safe(), criado_em: z.string().datetime({ offset: true }), reconciliado: z.boolean() }).strict();
const pedidoSchema = z.object({ atorId: uuid, requestId: uuid, clienteId: uuid, loteId: uuid, revisao: z.number().int().positive().safe(), motivo: z.string().trim().min(1).max(2000) }).strict();
export type PedidoReconciliacaoCronograma = z.input<typeof pedidoSchema>;

/** Consulta parcial; não certifica que os lotes estejam aptos ao transporte. */
export async function listarCronogramasLegados(clienteId: string, apos: string | null, signal?: AbortSignal) {
  const cliente = uuid.parse(clienteId);
  const cursor = uuid.nullable().parse(apos);
  let consulta = supabase.schema("pcm").rpc("sso_listar_cronogramas_legados", { p_cliente_id: cliente, p_apos: cursor, p_limite: 20 });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  signal?.throwIfAborted();
  const itens = z.array(linha).max(20).parse(data);
  let anterior = cursor?.toLowerCase() ?? "";
  return itens.map((item) => {
    const chave = item.id.toLowerCase();
    if (chave <= anterior) throw new Error("Paginação de lotes inválida.");
    anterior = chave;
    return { id: item.id, fonte: item.fonte_id, revisao: item.revisao, criadoEm: item.criado_em, reconciliado: item.reconciliado };
  });
}

/** A confirmação exige identidade e revisão do mesmo pedido; não faz retry automático. */
export async function reconciliarCronogramaLegado(entrada: PedidoReconciliacaoCronograma): Promise<void> {
  const pedido = pedidoSchema.parse(entrada);
  const { data, error } = await supabase.schema("pcm").rpc("sso_reconciliar_cronograma_por_ator", {
    p_ator_id: pedido.atorId, p_request_id: pedido.requestId, p_lote_id: pedido.loteId, p_cliente_id: pedido.clienteId, p_revisao: pedido.revisao, p_motivo: pedido.motivo,
  });
  if (error) throw error;
  const resultado = z.object({ aggregateId: uuid, revision: z.number().int().positive().safe(), state: z.literal("pendente"), requestId: uuid }).strict().parse(data);
  if (resultado.aggregateId.toLowerCase() !== pedido.loteId.toLowerCase() || resultado.requestId.toLowerCase() !== pedido.requestId.toLowerCase() || resultado.revision !== pedido.revisao) throw new Error("Confirmação de reconciliação divergente.");
}
