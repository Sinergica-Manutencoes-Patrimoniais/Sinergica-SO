import { supabase } from "../../../lib/supabase-client";
import { z } from "zod";
import type { DespesasVisitaGateway } from "../application/despesas-visita";

/** Não usar antes do rollout coordenado e da validação de autorização no servidor. */
export const supabaseDespesasVisitaAdapter: DespesasVisitaGateway = {
  async criar(input) {
    if (input.expectedRevision !== undefined || input.comprovantes.length !== 0)
      throw new Error("Edição e comprovantes ainda não disponíveis.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_criar_despesa_visita", {
      p_request_id: input.requestId,
      p_despesa_id: input.despesaId,
      p_visita_id: input.visitaId,
      p_categoria_id: input.categoriaId,
      p_data: input.data,
      p_descricao: input.descricao,
      p_previsto_centavos: input.previstoCentavos,
      p_realizado_centavos: input.realizadoCentavos ?? null,
    });
    if (error) throw error;
    if (
      !data ||
      typeof data.aggregateId !== "string" ||
      data.aggregateId !== input.despesaId ||
      !Number.isSafeInteger(data.revision) ||
      data.revision !== 1 ||
      data.state !== "ativa"
    )
      throw new Error("Resposta de despesa inválida.");
    return { aggregateId: data.aggregateId, revision: data.revision, state: data.state };
  },
};

export interface DespesaVisitaListada {
  id: string;
  descricao: string;
  data: string;
  previstoCentavos: number;
  realizadoCentavos: number | null;
  status: "ativa" | "cancelada";
  revisao: number;
}

const realizarDespesaSchema = z.object({
  requestId: z.string().uuid(),
  despesaId: z.string().uuid(),
  visitaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  realizadoCentavos: z.number().int().nonnegative().safe(),
  comprovanteObjetoId: z.string().uuid(),
}).strict();
export type RealizarDespesa = z.infer<typeof realizarDespesaSchema>;
export const validarRealizarDespesa = (v: unknown) => realizarDespesaSchema.parse(v);
export async function resolverComprovanteUpload(caminho: string): Promise<string> {
  const { data, error } = await supabase.schema("pcm").rpc("sso_resolver_comprovante_upload", { p_nome: caminho });
  if (error || typeof data !== "string" || !z.string().uuid().safeParse(data).success) throw error ?? new Error("Upload não confirmado.");
  return data;
}
export async function enviarComprovanteDespesa(caminho: string, arquivo: File, exigirRespostaUpload = false): Promise<string> {
  if (arquivo.size <= 0 || arquivo.size > 10 * 1024 * 1024 ||
    !["application/pdf", "image/jpeg", "image/png"].includes(arquivo.type))
    throw new Error("Arquivo inválido: use PDF, JPEG ou PNG de até 10 MB.");
  const { error: uploadError } = await supabase.storage.from("sso-despesas-visita")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (exigirRespostaUpload && uploadError) throw uploadError;
  // Uma resposta de upload perdida pode ter criado o objeto. Consultar o mesmo caminho,
  // nunca substituir nem criar um segundo objeto na tentativa repetida.
  try { return await resolverComprovanteUpload(caminho); }
  catch (error) { throw uploadError ?? error; }
}
export async function ingerirComprovanteDespesa(requestId: string, despesaId: string, arquivo: File): Promise<string> {
  z.string().uuid().parse(requestId); z.string().uuid().parse(despesaId);
  if (arquivo.size <= 0 || arquivo.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(arquivo.type)) throw new Error("Arquivo inválido.");
  const { data, error } = await supabase.functions.invoke("pcm-comprovante-ingestao", { body: arquivo, headers: { "x-request-id": requestId, "x-despesa-id": despesaId } });
  if (error) throw error;
  const resposta = z.object({ requestId: z.string().uuid(), objetoId: z.string().uuid() }).strict().parse(data);
  if (resposta.requestId !== requestId) throw new Error("Resposta de ingestão divergente.");
  return resposta.objetoId;
}
export async function baixarComprovanteDespesa(despesaId: string): Promise<Blob> {
  z.string().uuid().parse(despesaId);
  const unificada = import.meta.env.VITE_SSO_LEITURA_COMPROVANTE_UNIFICADA_ENABLED === "true";
  const { data, error } = unificada
    ? await supabase.functions.invoke<Blob>("despesa-visita-comprovante-unificado", { body: {}, headers: { "x-despesa-id": despesaId } })
    : await supabase.functions.invoke<Blob>("despesa-visita-comprovante-seguro", { body: { lancamentoId: despesaId } });
  if (error) throw error;
  if (!(data instanceof Blob)) throw new Error("Resposta de comprovante inválida.");
  return data;
}
const rateioSchema = z.object({
  requestId: z.string().uuid(), despesaId: z.string().uuid(), visitaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  parcelas: z.array(z.object({ vinculoId: z.string().uuid(), valorCentavos: z.number().int().nonnegative().safe() }).strict()).max(100),
}).strict().refine((v) => new Set(v.parcelas.map((p) => p.vinculoId.toLowerCase())).size === v.parcelas.length);
export type RatearDespesa = z.infer<typeof rateioSchema>;
export const validarRateioDespesa = (v: unknown) => rateioSchema.parse(v);
export async function ratearDespesa(input: RatearDespesa) {
  const c = validarRateioDespesa(input);
  const { data, error } = await supabase.schema("pcm").rpc("sso_ratear_despesa_visita", {
    p_request_id: c.requestId, p_despesa_id: c.despesaId, p_expected_revision: c.expectedRevision, p_parcelas: c.parcelas,
  });
  if (error) throw error;
  if (!data || data.aggregateId !== c.despesaId || data.requestId !== c.requestId ||
    data.revision !== c.expectedRevision + 1 || data.linkedIds?.visitaId !== c.visitaId || data.state !== "ativa")
    throw new Error("Resposta de rateio inválida.");
  return data;
}
export async function consultarRateio(despesaId: string) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_rateio_despesa", { p_despesa_id: despesaId });
  if (error) throw error;
  return z.array(z.object({ revisao: z.number().int().positive(), vinculo_id: z.string().uuid(),
    os_id: z.string().uuid(), valor_centavos: z.number().int().nonnegative().safe(), vinculo_vigente: z.boolean() })).parse(data);
}
export async function consultarOsParaRateio(clienteId: string, visitaId: string, cursor?: { sequencia: number; id: string } | null, signal?: AbortSignal) {
  let consulta = supabase.schema("pcm").rpc("sso_listar_os_visita", {
    p_cliente_id: clienteId, p_visita_id: visitaId, p_incluir_historico: false, p_limite: 100,
    p_apos_sequencia: cursor?.sequencia ?? null, p_apos_id: cursor?.id ?? null,
  });
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  const itens = z.array(z.object({ id: z.string().uuid(), numero: z.string(), titulo: z.string(), sequencia: z.number().int().positive() }).passthrough()).max(100).parse(data);
  let anterior = cursor ?? null;
  for (const item of itens) {
    if (anterior && (item.sequencia < anterior.sequencia || (item.sequencia === anterior.sequencia && item.id.toLowerCase() <= anterior.id.toLowerCase()))) throw new Error("Página de OS inválida.");
    anterior = { sequencia: item.sequencia, id: item.id };
  }
  return itens;
}
export async function realizarDespesa(input: RealizarDespesa, modo: "legado" | "mediado" = "legado") {
  const c = validarRealizarDespesa(input);
  const { data, error } = await supabase.schema("pcm").rpc(modo === "mediado" ? "sso_realizar_despesa_ingestao" : "sso_realizar_despesa_visita", {
    p_request_id: c.requestId,
    p_despesa_id: c.despesaId,
    p_expected_revision: c.expectedRevision,
    p_realizado_centavos: c.realizadoCentavos,
    p_comprovante_objeto_id: c.comprovanteObjetoId,
  });
  if (error) throw error;
  if (!data || data.aggregateId !== c.despesaId || data.requestId !== c.requestId ||
      data.revision !== c.expectedRevision + 1 || data.state !== "ativa" ||
      data.linkedIds?.visitaId !== c.visitaId) throw new Error("Resposta inválida.");
  return data;
}

const declararRepasseSchema = z.object({
  requestId: z.string().uuid(),
  despesaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),
  regraContratual: z.string().trim().min(1).max(500),
  justificativa: z.string().trim().min(1).max(2000),
}).strict();
export type DeclararRepasse = z.infer<typeof declararRepasseSchema>;
export const validarDeclararRepasse = (v: unknown) => declararRepasseSchema.parse(v);

/** Apenas prepara item para conferência; não fatura nem cria recebível. */
export async function declararRepasse(input: DeclararRepasse) {
  const c = validarDeclararRepasse(input);
  const { data, error } = await supabase.schema("financeiro").rpc("sso_declarar_repasse_despesa", {
    p_request_id: c.requestId,
    p_despesa_id: c.despesaId,
    p_expected_revision: c.expectedRevision,
    p_competencia: c.competencia,
    p_regra_contratual: c.regraContratual,
    p_justificativa: c.justificativa,
  });
  if (error) throw error;
  if (!data || typeof data.aggregateId !== "string" || data.requestId !== c.requestId ||
      data.linkedIds?.despesaId !== c.despesaId || !Number.isSafeInteger(data.revision) ||
      data.revision < 1 || typeof data.state !== "string") throw new Error("Resposta inválida.");
  return data;
}

const editarPrevisaoSchema = z
  .object({
    requestId: z.string().uuid(),
    despesaId: z.string().uuid(),
    visitaId: z.string().uuid(),
    expectedRevision: z.number().int().positive(),
    acao: z.enum(["alterar", "cancelar"]),
    data: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    descricao: z.string().max(10000).nullable(),
    previstoCentavos: z.number().int().nonnegative().safe().nullable(),
    motivo: z
      .string()
      .max(2000)
      .refine((v) => v.trim().length > 0),
  })
  .strict()
  .refine((v) =>
    v.acao === "cancelar"
      ? v.data === null && v.descricao === null && v.previstoCentavos === null
      : v.data !== null &&
        v.descricao !== null &&
        v.descricao.trim().length > 0 &&
        v.previstoCentavos !== null,
  );
export type AlterarPrevisao = z.infer<typeof editarPrevisaoSchema>;
export const validarAlterarPrevisao = (v: unknown) => editarPrevisaoSchema.parse(v);
export async function alterarPrevisao(input: AlterarPrevisao) {
  const c = validarAlterarPrevisao(input);
  const { data, error } = await supabase.schema("pcm").rpc("sso_alterar_previsao_visita", {
    p_request_id: c.requestId,
    p_despesa_id: c.despesaId,
    p_expected_revision: c.expectedRevision,
    p_acao: c.acao,
    p_data: c.data,
    p_descricao: c.descricao,
    p_previsto_centavos: c.previstoCentavos,
    p_motivo: c.motivo,
  });
  if (error) throw error;
  if (
    !data ||
    data.aggregateId !== c.despesaId ||
    data.revision !== c.expectedRevision + 1 ||
    data.requestId !== c.requestId ||
    data.state !== (c.acao === "alterar" ? "ativa" : "cancelada") ||
    data.linkedIds?.visitaId !== c.visitaId
  )
    throw new Error("Resposta inválida.");
  return data;
}

export async function listarCategoriasDespesa(
  aposId: string | null,
  signal?: AbortSignal,
): Promise<Array<{ id: string; nome: string }>> {
  if (aposId !== null && !z.string().uuid().safeParse(aposId).success)
    throw new Error("Cursor de categorias inválido.");
  let consulta = supabase
    .schema("pcm")
    .from("despesa_tipos")
    .select("id,nome")
    .order("id")
    .limit(100);
  if (aposId) consulta = consulta.gt("id", aposId);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  if (!Array.isArray(data) || data.length > 100) throw new Error("Categorias indisponíveis.");
  let anterior = aposId?.toLowerCase() ?? null;
  return data.map((row) => {
    if (typeof row.id !== "string" || !z.string().uuid().safeParse(row.id).success || typeof row.nome !== "string" || (anterior !== null && row.id.toLowerCase() <= anterior))
      throw new Error("Categorias inválidas.");
    anterior = row.id.toLowerCase();
    return { id: row.id, nome: row.nome };
  });
}

/** Leitura com escopo explícito; a autorização efetiva permanece na RLS. */
export async function listarDespesasVisita(
  clienteId: string,
  visitaId: string,
  aposId: string | null,
  signal?: AbortSignal,
): Promise<DespesaVisitaListada[]> {
  if (!clienteId.trim() || !visitaId.trim()) throw new Error("Contexto inválido.");
  let consulta = supabase
    .schema("pcm")
    .from("despesas_visita")
    .select(
      "id,cliente_id,visita_id,descricao,data,previsto_centavos,realizado_centavos,status,revisao",
    )
    .eq("cliente_id", clienteId)
    .eq("visita_id", visitaId)
    .order("id")
    .limit(20);
  if (aposId) consulta = consulta.gt("id", aposId);
  if (signal) consulta = consulta.abortSignal(signal);
  const { data, error } = await consulta;
  if (error) throw error;
  if (!Array.isArray(data) || data.length > 20) throw new Error("Resposta de despesas inválida.");
  let anterior = aposId?.toLowerCase() ?? null;
  return data.map((row) => {
    if (
      row.cliente_id !== clienteId ||
      row.visita_id !== visitaId ||
      typeof row.id !== "string" ||
      (anterior !== null && row.id.toLowerCase() <= anterior) ||
      typeof row.descricao !== "string" ||
      typeof row.data !== "string" ||
      !Number.isSafeInteger(row.revisao) ||
      row.revisao < 1 ||
      !Number.isSafeInteger(row.previsto_centavos) ||
      row.previsto_centavos < 0 ||
      (row.realizado_centavos !== null &&
        (!Number.isSafeInteger(row.realizado_centavos) || row.realizado_centavos < 0)) ||
      (row.status !== "ativa" && row.status !== "cancelada")
    )
      throw new Error("Resposta de despesas inválida.");
    anterior = row.id.toLowerCase();
    return {
      id: row.id,
      descricao: row.descricao,
      data: row.data,
      previstoCentavos: row.previsto_centavos,
      realizadoCentavos: row.realizado_centavos,
      status: row.status,
      revisao: row.revisao,
    };
  });
}
