import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

const uuid = z.string().guid();
const centavos = z.number().int().nonnegative().safe();
const itemSchema = z
  .object({
    id: uuid,
    origem_tipo: z.string(),
    origem_id: uuid,
    valor_original_centavos: centavos,
    valor_conferido_centavos: centavos.nullable(),
    competencia: z.string().regex(/^\d{4}-\d{2}-01$/),
    status: z.enum(["pendente", "conferido", "parcial", "faturado", "cancelado"]),
    revisao: z.number().int().positive(),
  })
  .strict();
const comandoSchema = z
  .object({
    requestId: uuid,
    itemId: uuid,
    expectedRevision: z.number().int().positive(),
    acao: z.enum(["conferir", "cancelar"]),
    valorCentavos: centavos.nullable(),
    motivo: z.string().max(2000).nullable(),
  })
  .strict()
  .refine((v) =>
    v.acao === "conferir"
      ? v.valorCentavos !== null
      : v.valorCentavos === null && !!v.motivo?.trim(),
  );
export type ComandoFaturavel = z.infer<typeof comandoSchema>;
export const validarComandoFaturavel = (valor: unknown) => comandoSchema.parse(valor);
const competenciaValida = (valor: string) => /^(?!0000)\d{4}-(0[1-9]|1[0-2])-01$/.test(valor);
export const supabaseFaturaveisAdapter = {
  async listarPeriodo(cliente: string, status: string | null, origem: string | null, inicio: string | null, fim: string | null, limite: number, apos: string | null, signal?: AbortSignal) {
    uuid.parse(cliente);
    if ((status !== null && !["pendente", "conferido", "parcial", "faturado", "cancelado"].includes(status)) ||
      (origem !== null && !/^[a-z0-9_]{1,64}$/.test(origem)) ||
      (inicio !== null && !competenciaValida(inicio)) || (fim !== null && !competenciaValida(fim)) ||
      (inicio !== null && fim !== null && inicio > fim) || !Number.isSafeInteger(limite) || limite < 1 || limite > 100 ||
      (apos !== null && !uuid.safeParse(apos).success)) throw new Error("Filtro inválido.");
    let query = supabase.schema("financeiro").rpc("sso_listar_faturaveis_periodo", {
      p_cliente_id: cliente, p_status: status, p_origem: origem, p_competencia_inicio: inicio,
      p_competencia_fim: fim, p_limite: limite, p_apos: apos,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const itens = z.array(itemSchema).max(limite).parse(data);
    let anterior = apos?.toLowerCase() ?? null;
    for (const item of itens) {
      const id = item.id.toLowerCase();
      if ((anterior !== null && id <= anterior) || (status !== null && item.status !== status) ||
        (origem !== null && !item.origem_tipo.includes(origem)) || !competenciaValida(item.competencia) ||
        (inicio !== null && item.competencia < inicio) || (fim !== null && item.competencia > fim)) throw new Error("Página inválida.");
      anterior = id;
    }
    return itens;
  },
  async listarFiltrados(cliente: string, status: string | null, origem: string | null, limite: number, apos: string | null, signal?: AbortSignal) {
    uuid.parse(cliente);
    if ((status !== null && !["pendente", "conferido", "parcial", "faturado", "cancelado"].includes(status)) ||
      (origem !== null && !/^[a-z0-9_]{1,64}$/.test(origem)) || !Number.isSafeInteger(limite) || limite < 1 || limite > 100 ||
      (apos !== null && !uuid.safeParse(apos).success)) throw new Error("Filtro inválido.");
    let query = supabase.schema("financeiro").rpc("sso_listar_faturaveis_filtrados", {
      p_cliente_id: cliente, p_status: status, p_origem: origem, p_limite: limite, p_apos: apos,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const itens = z.array(itemSchema).max(limite).parse(data);
    let anterior = apos?.toLowerCase() ?? null;
    for (const item of itens) {
      const id = item.id.toLowerCase();
      if ((anterior !== null && id <= anterior) || (status !== null && item.status !== status) ||
        (origem !== null && !item.origem_tipo.includes(origem))) throw new Error("Página inválida.");
      anterior = id;
    }
    return itens;
  },
  async listar(cliente: string, limite: number, apos: string | null, signal?: AbortSignal) {
    uuid.parse(cliente);
    if (
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100 ||
      (apos !== null && !uuid.safeParse(apos).success)
    )
      throw new Error("Paginação inválida.");
    let query = supabase
      .schema("financeiro")
      .rpc("sso_listar_faturaveis_cliente", {
        p_cliente_id: cliente,
        p_limite: limite,
        p_apos: apos,
      });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const itens = z.array(itemSchema).parse(data);
    if (itens.length > limite) throw new Error("Página inválida.");
    let anterior = apos?.toLowerCase() ?? null;
    for (const item of itens) {
      const atual = item.id.toLowerCase();
      if (anterior !== null && atual <= anterior) throw new Error("Página inválida.");
      anterior = atual;
    }
    return itens;
  },
  async decidir(entrada: ComandoFaturavel) {
    const c = validarComandoFaturavel(entrada);
    const { data, error } = await supabase
      .schema("financeiro")
      .rpc("sso_conferir_ou_cancelar_faturavel", {
        p_request_id: c.requestId,
        p_item_id: c.itemId,
        p_expected_revision: c.expectedRevision,
        p_acao: c.acao,
        p_valor_centavos: c.valorCentavos,
        p_motivo: c.motivo,
      });
    if (error) throw error;
    const resposta = z
      .object({
        aggregateId: uuid,
        revision: z.number().int().positive(),
        state: z.enum(["conferido", "cancelado"]),
        created: z.literal(false),
        linkedIds: z.object({}).strict(),
        warnings: z.array(z.string()),
        requestId: uuid,
      })
      .strict()
      .parse(data);
    if (
      resposta.aggregateId !== c.itemId ||
      resposta.revision !== c.expectedRevision + 1 ||
      resposta.requestId !== c.requestId ||
      resposta.state !== (c.acao === "conferir" ? "conferido" : "cancelado")
    )
      throw new Error("Resposta inconsistente.");
    return resposta;
  },
};
