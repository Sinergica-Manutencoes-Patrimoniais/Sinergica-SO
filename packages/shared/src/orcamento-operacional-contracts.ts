import { z } from "zod";

/** Composição privada: não usar este contrato como projeção para o Portal. */
export const prepararOrcamentoOperacionalSchema = z.object({
  requestId: z.string().uuid(),
  propostaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  listaId: z.string().uuid(),
  listaRevision: z.number().int().positive(),
  descricao: z.string().refine((v) => v.trim().length > 0 && v.length <= 4000),
  custoAquisicaoCentavos: z.number().int().min(0).max(1_000_000_000_000),
  custosOperacionaisCentavos: z.number().int().min(0).max(1_000_000_000_000),
  fator: z.number().min(1).max(100),
  precoCentavos: z.number().int().min(0).max(1_000_000_000_000),
}).strict();

export type PrepararOrcamentoOperacional = z.infer<typeof prepararOrcamentoOperacionalSchema>;
