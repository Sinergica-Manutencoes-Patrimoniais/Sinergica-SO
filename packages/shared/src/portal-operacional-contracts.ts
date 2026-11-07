import { z } from "zod";

/** Contratos públicos: autorização e vínculo com Cliente continuam obrigatórios no servidor. */
export const portalInformarMaterialSchema = z.object({
  requestId: z.string().guid(), listaId: z.string().guid(), expectedRevision: z.number().int().positive(),
  situacao: z.enum(["informada_disponivel", "parcial", "indisponivel"]),
}).strict();
export type PortalInformarMaterial = z.infer<typeof portalInformarMaterialSchema>;

export const portalDecisaoOrcamentoSchema = z.object({
  requestId: z.string().guid(), propostaId: z.string().guid(), versao: z.number().int().positive(),
  decisao: z.enum(["aceita", "recusada"]), motivo: z.string().max(2000).nullable(),
}).strict().refine((valor) => valor.decisao !== "recusada" || !!valor.motivo?.trim());
export type PortalDecisaoOrcamento = z.infer<typeof portalDecisaoOrcamentoSchema>;

export const portalListaMateriaisSchema = z.object({
  id: z.string().guid(), ordem_servico_id: z.string().guid(), responsavel: z.enum(["cliente", "sinergica"]),
  estado: z.string(), revisao: z.number().int().positive(),
  linhas: z.array(z.object({ descricao: z.string(), quantidade: z.string().nullable(), unidade: z.string().nullable() }).strict()),
  publicado_em: z.string(), ultima_informacao_em: z.string().nullable(), ultima_informacao_por: z.string().guid().nullable(),
  excecao_atual: z.boolean(),
}).strict();
export type PortalListaMateriais = z.infer<typeof portalListaMateriaisSchema>;

export const portalCobrancaOsSchema = z.object({
  lancamento_id: z.string().guid(), descricao: z.string(), valor_centavos: z.number().int().positive().safe(),
  competencia: z.string(), vencimento: z.string().nullable(), situacao: z.enum(["paga", "vencida", "em_aberto"]),
}).strict();
export type PortalCobrancaOs = z.infer<typeof portalCobrancaOsSchema>;
