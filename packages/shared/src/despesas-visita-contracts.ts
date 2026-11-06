import { z } from "zod";

const uuid = z.string().uuid();
const centavos = z.number().int().nonnegative().safe();
const revisao = z.number().int().nonnegative().safe();
const data = z.string().refine((v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Data inválida.");

/** Referências de comprovante são identificadores opacos; servidor verifica existência e acesso. */
export const registrarDespesaVisitaSchema = z
  .object({
    requestId: uuid,
    despesaId: uuid,
    visitaId: uuid,
    categoriaId: uuid,
    data,
    descricao: z.string().trim().min(1).max(10000),
    previstoCentavos: centavos,
    realizadoCentavos: centavos.nullable().optional(),
    comprovantes: z.array(uuid),
    expectedRevision: revisao.optional(),
  })
  .strict();
export const ratearDespesaVisitaSchema = z
  .object({
    requestId: uuid,
    despesaId: uuid,
    expectedRevision: revisao,
    parcelas: z.array(z.object({ osId: uuid, valorCentavos: centavos }).strict()),
  })
  .strict()
  .refine(
    (v) => new Set(v.parcelas.map((p) => p.osId.toLowerCase())).size === v.parcelas.length,
    "OS repetida no rateio.",
  );
export const cancelarDespesaVisitaSchema = z
  .object({
    requestId: uuid,
    despesaId: uuid,
    expectedRevision: revisao,
    motivo: z.string().trim().min(1).max(2000),
  })
  .strict();

export type RegistrarDespesaVisita = z.infer<typeof registrarDespesaVisitaSchema>;
export type RatearDespesaVisita = z.infer<typeof ratearDespesaVisitaSchema>;
export type CancelarDespesaVisita = z.infer<typeof cancelarDespesaVisitaSchema>;
