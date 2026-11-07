import { z } from "zod";
const uuid = z.string().guid();
const centavos = z.number().int().nonnegative().safe();
const revisao = z.number().int().nonnegative().safe();
const motivo = z.string().trim().min(1).max(2000);

/** Contrato servidor-servidor; Cliente, elegibilidade e valor devem ser confirmados na fonte oficial. */
export const receberFaturavelSchema = z
  .object({
    requestId: uuid,
    clienteId: uuid,
    origemTipo: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    origemId: uuid,
    valorCentavos: centavos,
    competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    evidencias: z.array(uuid),
  })
  .strict();
export const estornarFaturavelSchema = z
  .object({
    requestId: uuid,
    itemId: uuid,
    alocacaoId: uuid,
    expectedRevision: revisao,
    valorCentavos: centavos.positive(),
    motivo,
  })
  .strict();
export const complementarFaturavelSchema = z
  .object({
    requestId: uuid,
    itemBaseId: uuid,
    complementoId: uuid,
    expectedRevision: revisao,
    valorCentavos: centavos,
    motivo,
  })
  .strict()
  .refine((v) => v.itemBaseId !== v.complementoId, "Complemento deve ter identidade própria.");
export type ReceberFaturavel = z.infer<typeof receberFaturavelSchema>;
export type EstornarFaturavel = z.infer<typeof estornarFaturavelSchema>;
export type ComplementarFaturavel = z.infer<typeof complementarFaturavelSchema>;
