import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

export const transferenciaVisitaSchema = z.object({
  requestId: z.string().uuid(), origemId: z.string().uuid(), destinoId: z.string().uuid(),
  vinculoId: z.string().uuid(), novoVinculoId: z.string().uuid(),
  revisaoOrigem: z.number().int().safe().positive(), revisaoDestino: z.number().int().safe().positive(),
  sequencia: z.number().int().safe().positive(), motivo: z.string().trim().min(1).max(2000),
  confirmadas: z.boolean().optional(),
}).strict().refine((v) => v.origemId !== v.destinoId);
export type TransferenciaVisita = z.infer<typeof transferenciaVisitaSchema>;

export const supabaseTransferenciaVisitaAdapter = {
  async consultarRecibo(entrada: TransferenciaVisita, atorId: string, clienteId: string) {
    const c = transferenciaVisitaSchema.parse(entrada);
    const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_transferencia_visita", {
      p_request_id: c.requestId, p_ator_id: atorId, p_cliente_id: clienteId,
      p_origem_id: c.origemId, p_destino_id: c.destinoId, p_vinculo_id: c.vinculoId,
      p_novo_vinculo_id: c.novoVinculoId, p_revisao_origem: c.revisaoOrigem,
      p_revisao_destino: c.revisaoDestino, p_sequencia: c.sequencia, p_motivo: c.motivo,
      p_confirmadas: c.confirmadas ?? false,
    });
    if (error) throw error;
    const recibo = z.discriminatedUnion("encontrado", [
      z.object({ encontrado: z.literal(false), requestId: z.string().uuid() }).strict(),
      z.object({ encontrado: z.literal(true), requestId: z.string().uuid(), resultado: z.object({
        origemId: z.string().uuid(), destinoId: z.string().uuid(), osId: z.string().uuid(),
        novoVinculoId: z.string().uuid(), requestId: z.string().uuid(),
        reconfirmacaoNecessaria: z.boolean().optional(),
      }).strict() }).strict(),
    ]).parse(data);
    if (recibo.requestId !== c.requestId || (recibo.encontrado && (
      recibo.resultado.requestId !== c.requestId || recibo.resultado.origemId !== c.origemId ||
      recibo.resultado.destinoId !== c.destinoId || recibo.resultado.novoVinculoId !== c.novoVinculoId
    ))) throw new Error("Recibo divergente.");
    return recibo;
  },
  async transferir(entrada: TransferenciaVisita, atorId: string, clienteId: string) {
    const c = transferenciaVisitaSchema.parse(entrada);
    if (c.confirmadas && import.meta.env.VITE_SSO_TRANSFERENCIA_CONFIRMADA_ENABLED !== "true") throw new Error("Transferência de Visita confirmada desativada.");
    const mediado = import.meta.env.VITE_SSO_TRANSFERENCIA_VISITA_MEDIADA_ENABLED === "true";
    const { data, error } = await supabase.schema("pcm").rpc(mediado ? "sso_transferir_os_visita_mediado" : c.confirmadas ? "sso_transferir_os_confirmada_preparado" : "sso_transferir_os_visita_preparado", {
      ...(mediado ? { p_ator_id: atorId, p_cliente_id: clienteId, p_confirmadas: c.confirmadas ?? false } : {}),
      p_request_id: c.requestId, p_origem_id: c.origemId, p_destino_id: c.destinoId,
      p_vinculo_id: c.vinculoId, p_novo_vinculo_id: c.novoVinculoId, p_revisao_origem: c.revisaoOrigem,
      p_revisao_destino: c.revisaoDestino, p_sequencia: c.sequencia, p_motivo: c.motivo,
    });
    if (error) throw error;
    const resultado = z.object({ origemId: z.string().uuid(), destinoId: z.string().uuid(), osId: z.string().uuid(),
      novoVinculoId: z.string().uuid(), requestId: z.string().uuid(), reconfirmacaoNecessaria: z.boolean().optional() }).strict().parse(data);
    if (resultado.origemId !== c.origemId || resultado.destinoId !== c.destinoId
      || resultado.novoVinculoId !== c.novoVinculoId || resultado.requestId !== c.requestId)
      throw new Error("Resposta de transferência divergente.");
    return resultado;
  },
};
