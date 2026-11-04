import { z } from "zod";
import { prepararOrcamentoOperacionalSchema, type PrepararOrcamentoOperacional } from "@sinergica/shared";
import { supabase } from "../../../lib/supabase-client";

const itemSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum([
      "rascunho",
      "em_revisao",
      "aprovada",
      "enviada",
      "aceita",
      "recusada",
      "cancelada",
    ]),
    versao: z.number().int().positive(),
    lista_id: z.string().uuid(),
    lista_revisao: z.number().int().positive(),
  })
  .strict();

export type PrepararOrcamento = PrepararOrcamentoOperacional;
export const validarPrepararOrcamento = (valor: unknown) => prepararOrcamentoOperacionalSchema.parse(valor);

const parcelaSchema = z.object({ despesa_id: z.string().uuid(), despesa_revision: z.number().int().positive(), rateio_revision: z.number().int().positive(), vinculo_id: z.string().uuid(), descricao: z.string().min(1).max(10000), valor_centavos: z.number().int().safe().nonnegative().max(1_000_000_000_000), base: z.enum(["previsto", "realizado"]) }).strict();
const fonteSchema = z.object({ despesaId: z.string().uuid(), despesaRevision: z.number().int().positive(), rateioRevision: z.number().int().positive(), vinculoId: z.string().uuid(), valorCentavos: z.number().int().safe().nonnegative().max(1_000_000_000_000), base: z.enum(["previsto", "realizado"]), descricaoFonte: z.string().min(1).max(10000), grupo: z.enum(["aquisicao", "operacional"]) }).strict();
export const prepararParcelasSchema = z.object({
  atorId: z.string().uuid(), clienteId: z.string().uuid(), requestId: z.string().uuid(), propostaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(), listaId: z.string().uuid(), listaRevision: z.number().int().positive(),
  descricao: z.string().trim().min(1).max(4000), fontes: z.array(fonteSchema).min(1).max(100),
  fator: z.number().finite().min(1).max(100), precoCentavos: z.number().int().safe().nonnegative().max(1_000_000_000_000),
}).strict().superRefine((p, ctx) => {
  const chaves = new Set<string>();
  for (const fonte of p.fontes) {
    const chave = JSON.stringify([fonte.despesaId.toLowerCase(), fonte.vinculoId.toLowerCase()]);
    if (chaves.has(chave)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Parcela repetida.", path: ["fontes"] });
    chaves.add(chave);
  }
});
export type PrepararOrcamentoParcelas = z.infer<typeof prepararParcelasSchema>;

export const prepararMistoSchema = z.object({
  atorId: z.string().uuid(), clienteId: z.string().uuid(), requestId: z.string().uuid(), propostaId: z.string().uuid(),
  expectedRevision: z.number().int().positive(), listaId: z.string().uuid(), listaRevision: z.number().int().positive(),
  descricao: z.string().trim().min(1).max(4000), aquisicaoIds: z.array(z.string().uuid()).max(100),
  fontes: z.array(fonteSchema.extend({ grupo: z.literal("operacional") })).max(100),
  fator: z.number().finite().min(1).max(100), precoCentavos: z.number().int().safe().nonnegative().max(1_000_000_000_000),
}).strict().superRefine((p, ctx) => {
  if (p.aquisicaoIds.length + p.fontes.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione ao menos uma fonte." });
  const aquisicoes = p.aquisicaoIds.map((id) => id.toLowerCase());
  if (new Set(aquisicoes).size !== aquisicoes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Aquisição repetida.", path: ["aquisicaoIds"] });
  const parcelas = p.fontes.map((f) => JSON.stringify([f.despesaId.toLowerCase(), f.vinculoId.toLowerCase()]));
  if (new Set(parcelas).size !== parcelas.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Parcela repetida.", path: ["fontes"] });
});
export type PrepararOrcamentoMisto = z.infer<typeof prepararMistoSchema>;

export async function prepararOrcamentoMisto(entrada: PrepararOrcamentoMisto) {
  const p = prepararMistoSchema.parse(entrada);
  const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== p.atorId) throw new Error("Sessão alterada.");
  const { data, error } = await supabase.schema("comercial").rpc("sso_preparar_orcamento_misto", {
    p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_proposta_id: p.propostaId,
    p_expected_revision: p.expectedRevision, p_lista_id: p.listaId, p_lista_revision: p.listaRevision,
    p_descricao: p.descricao, p_aquisicao_ids: p.aquisicaoIds, p_fontes: p.fontes, p_fator: p.fator, p_preco_centavos: p.precoCentavos,
  });
  if (error) throw error;
  const r = z.object({ aggregateId: z.string().uuid(), revision: z.number().int().positive(), state: z.literal("rascunho"), created: z.literal(false),
    linkedIds: z.object({ listaId: z.string().uuid(), ordemServicoId: z.string().uuid() }).strict(), warnings: z.array(z.string()), requestId: z.string().uuid() }).strict().parse(data);
  if (r.aggregateId !== p.propostaId || r.revision !== p.expectedRevision + 1 || r.requestId !== p.requestId || r.linkedIds.listaId !== p.listaId) throw new Error("Resposta inconsistente.");
  const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== p.atorId) throw new Error("Sessão alterada.");
  return r;
}

export async function listarParcelasOrcamento(atorId: string, clienteId: string, listaId: string, cursor: { despesaId: string; vinculoId: string } | null, signal?: AbortSignal) {
  z.string().uuid().parse(atorId); z.string().uuid().parse(clienteId); z.string().uuid().parse(listaId);
  if (cursor) { z.string().uuid().parse(cursor.despesaId); z.string().uuid().parse(cursor.vinculoId); }
  const antes = await supabase.auth.getUser();
  if (antes.error || antes.data.user?.id !== atorId || signal?.aborted) throw new Error("Sessão alterada.");
  let query = supabase.schema("comercial").rpc("sso_listar_parcelas_orcamento", { p_ator_id: atorId, p_cliente_id: clienteId, p_lista_id: listaId, p_apos_despesa: cursor?.despesaId ?? null, p_apos_vinculo: cursor?.vinculoId ?? null, p_limite: 30 });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query; if (error) throw error;
  const pagina = z.array(parcelaSchema).max(30).parse(data);
  let anterior = cursor ? [cursor.despesaId.toLowerCase(), cursor.vinculoId.toLowerCase()] : null;
  for (const item of pagina) {
    const atual = [item.despesa_id.toLowerCase(), item.vinculo_id.toLowerCase()];
    if (anterior && (atual[0]! < anterior[0]! || (atual[0] === anterior[0] && atual[1]! <= anterior[1]!))) throw new Error("Página de parcelas inconsistente.");
    anterior = atual;
  }
  const depois = await supabase.auth.getUser();
  if (depois.error || depois.data.user?.id !== atorId || signal?.aborted) throw new Error("Sessão alterada.");
  return pagina;
}

export async function prepararOrcamentoParcelas(entrada: PrepararOrcamentoParcelas) {
  const p = prepararParcelasSchema.parse(entrada);
  const antes = await supabase.auth.getUser();
  if (antes.error || antes.data.user?.id !== p.atorId) throw new Error("Sessão alterada.");
  const { data, error } = await supabase.schema("comercial").rpc("sso_preparar_orcamento_parcelas", {
    p_ator_id: p.atorId, p_cliente_id: p.clienteId, p_request_id: p.requestId, p_proposta_id: p.propostaId,
    p_expected_revision: p.expectedRevision, p_lista_id: p.listaId, p_lista_revision: p.listaRevision,
    p_descricao: p.descricao, p_fontes: p.fontes, p_fator: p.fator, p_preco_centavos: p.precoCentavos,
  });
  if (error) throw error;
  const resposta = z.object({ aggregateId: z.string().uuid(), revision: z.number().int().positive(), state: z.literal("rascunho"), created: z.literal(false), linkedIds: z.object({ listaId: z.string().uuid(), ordemServicoId: z.string().uuid() }).strict(), warnings: z.array(z.string()), requestId: z.string().uuid() }).strict().parse(data);
  if (resposta.aggregateId !== p.propostaId || resposta.revision !== p.expectedRevision + 1 || resposta.requestId !== p.requestId || resposta.linkedIds.listaId !== p.listaId) throw new Error("Resposta inconsistente.");
  const depois = await supabase.auth.getUser();
  if (depois.error || depois.data.user?.id !== p.atorId) throw new Error("Sessão alterada.");
  return resposta;
}

/** Leitura limitada, não expõe valores nem permite emissão ou decisão. */
export const supabaseOrcamentoOperacionalAdapter = {
  async preparar(entrada: PrepararOrcamento) {
    const c = validarPrepararOrcamento(entrada);
    const { data, error } = await supabase
      .schema("comercial")
      .rpc("sso_preparar_orcamento_operacional", {
        p_request_id: c.requestId,
        p_proposta_id: c.propostaId,
        p_expected_revision: c.expectedRevision,
        p_lista_id: c.listaId,
        p_lista_revision: c.listaRevision,
        p_descricao: c.descricao,
        p_custo_aquisicao_centavos: c.custoAquisicaoCentavos,
        p_custos_operacionais_centavos: c.custosOperacionaisCentavos,
        p_fator: c.fator,
        p_preco_centavos: c.precoCentavos,
      });
    if (error) throw error;
    const resposta = z
      .object({
        aggregateId: z.string().uuid(),
        revision: z.number().int().positive(),
        state: z.literal("rascunho"),
        created: z.literal(false),
        linkedIds: z
          .object({ listaId: z.string().uuid(), ordemServicoId: z.string().uuid() })
          .strict(),
        warnings: z.array(z.string()),
        requestId: z.string().uuid(),
      })
      .strict()
      .parse(data);
    if (
      resposta.aggregateId !== c.propostaId ||
      resposta.revision !== c.expectedRevision + 1 ||
      resposta.requestId !== c.requestId ||
      resposta.linkedIds.listaId !== c.listaId
    )
      throw new Error("Resposta inconsistente.");
    return resposta;
  },
  async listar(
    clienteId: string,
    ordemServicoId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ) {
    if (
      !z.string().uuid().safeParse(clienteId).success ||
      !z.string().uuid().safeParse(ordemServicoId).success ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100 ||
      (apos !== null && !z.string().uuid().safeParse(apos).success)
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase.schema("comercial").rpc("sso_listar_edicao_orcamentos_os", {
      p_cliente_id: clienteId,
      p_ordem_servico_id: ordemServicoId,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const itens = z.array(itemSchema).parse(data);
    let anterior = apos?.toLowerCase() ?? null;
    if (itens.length > limite) throw new Error("Página inválida.");
    for (const item of itens) {
      const atual = item.id.toLowerCase();
      if (anterior !== null && atual <= anterior) throw new Error("Página inválida.");
      anterior = atual;
    }
    return itens;
  },
};
