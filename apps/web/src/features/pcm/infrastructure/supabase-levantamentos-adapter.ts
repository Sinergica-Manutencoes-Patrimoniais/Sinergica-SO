import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import {
  type RecepcaoLevantamento,
  validarRecepcaoLevantamento,
} from "../application/recepcao-levantamento";

const respostaRecepcaoSchema = z
  .object({
    aggregateId: z.string().uuid(),
    revision: z.number().int().positive(),
    state: z.literal("pendente"),
    created: z.boolean(),
    linkedIds: z.object({}).strict(),
    warnings: z.array(z.string()),
    requestId: z.string().uuid(),
  })
  .strict();

const incorporacaoSchema = z.object({
  aggregateId: z.string().uuid(),
  revision: z.number().int().positive(),
  state: z.literal("pendente"),
  created: z.literal(true),
  linkedIds: z.object({ entidadeId: z.string().uuid(), tipo: z.enum(["area", "local", "sublocal"]) }).strict(),
  warnings: z.array(z.string()),
  requestId: z.string().uuid(),
}).strict();

export const pedidoAtivoSchema = z.object({
  requestId: z.string().uuid(), loteId: z.string().uuid(), chave: z.string().min(1).max(200),
  revisao: z.number().int().positive(), tipo: z.enum(["sistema", "equipamento", "componente", "grupo_quantitativo"]),
  localId: z.string().uuid(), categoriaId: z.string().uuid().nullable(), sistemaId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(), codigo: z.string().max(200).nullable(),
  quantidade: z.number().int().positive().safe().nullable(), codigoRevision: z.number().int().nonnegative(),
}).strict();
export type PedidoAtivo = z.infer<typeof pedidoAtivoSchema>;
const respostaAtivoSchema = incorporacaoSchema.extend({ linkedIds: z.object({
  entidadeId: z.string().uuid(), tipo: pedidoAtivoSchema.shape.tipo,
}).strict() });

const lotesSchema = z.array(
  z
    .object({
      id: z.string().uuid(),
      origem: z.enum(["planilha", "auvo", "campo", "manual"]),
      chave_origem: z.string(),
      revisao: z.number().int().positive(),
      criado_em: z.string().datetime({ offset: true }),
    })
    .strict(),
);
const linhasSchema = z.array(
  z
    .object({
      chave: z.string(),
      tipo: z.enum([
        "area",
        "local",
        "sublocal",
        "sistema",
        "equipamento",
        "componente",
        "grupo_quantitativo",
      ]),
      atributos: z
        .object({
          nome: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
          observacoes: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
          quantidade: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
          codigoInformado: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
          referenciaPai: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
          sistemaProvisorio: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
          localProvisorio: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
          classificacao: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
        })
        .strict(),
    })
    .strict(),
);
function validarLimite(limite: number) {
  if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
    throw new Error("Paginação inválida.");
}

// Sem rollout: recepção depende de 0320 e revisão integrada de autorização.
export const supabaseLevantamentosAdapter = {
  async consultarLoteRecebido(usuario: string, clienteId: string, loteId: string, signal?: AbortSignal) {
    z.string().uuid().parse(usuario); z.string().uuid().parse(clienteId); z.string().uuid().parse(loteId);
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada.");
    let consulta = supabase.schema("pcm").rpc("sso_consultar_lote_recebido", {p_ator_id: usuario,p_cliente_id: clienteId,p_lote_id: loteId});
    if (signal) consulta = consulta.abortSignal(signal);
    const {data,error} = await consulta; if (error) throw error;
    const lotes = lotesSchema.length(1).parse(data); const lote = lotes[0];
    if (!lote || lote.id !== loteId) throw new Error("Lote divergente.");
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== usuario || signal?.aborted) throw new Error("Sessão alterada.");
    return { id:lote.id, origem:lote.origem, chaveOrigem:lote.chave_origem, revisao:lote.revisao, criadoEm:lote.criado_em };
  },
  async incorporarAtivo(valor: PedidoAtivo) {
    const pedido = pedidoAtivoSchema.parse(valor);
    const { data, error } = await supabase.schema("pcm").rpc("sso_incorporar_ativo_autorizado", {
      p_request_id: pedido.requestId, p_lote_id: pedido.loteId, p_expected_revision: pedido.revisao,
      p_chave: pedido.chave, p_local_id: pedido.localId, p_categoria_id: pedido.categoriaId,
      p_sistema_id: pedido.sistemaId, p_parent_id: pedido.parentId, p_codigo: pedido.codigo,
      p_quantidade: pedido.quantidade, p_codigo_revision: pedido.codigoRevision,
    });
    if (error) throw error;
    const resposta = respostaAtivoSchema.parse(data);
    if (resposta.aggregateId !== pedido.loteId || resposta.requestId !== pedido.requestId ||
      resposta.revision !== pedido.revisao + 1 || resposta.linkedIds.tipo !== pedido.tipo)
      throw new Error("Resposta não corresponde à tentativa.");
    return resposta;
  },
  async incorporarLocalizacao(pedido: { requestId: string; loteId: string; chave: string; revisao: number; tipo: "area" | "local" | "sublocal" }) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_incorporar_localizacao_autorizada", {
      p_request_id: pedido.requestId,
      p_lote_id: pedido.loteId,
      p_expected_revision: pedido.revisao,
      p_chave: pedido.chave,
    });
    if (error) throw error;
    const resposta = incorporacaoSchema.parse(data);
    if (resposta.aggregateId !== pedido.loteId || resposta.requestId !== pedido.requestId ||
      resposta.revision !== pedido.revisao + 1 || resposta.linkedIds.tipo !== pedido.tipo)
      throw new Error("Resposta não corresponde à tentativa.");
    return resposta;
  },
  async receber(clienteId: string, valor: RecepcaoLevantamento) {
    const pedido = validarRecepcaoLevantamento(valor);
    const { data, error } = await supabase.schema("pcm").rpc("sso_receber_levantamento_manual", {
      p_request_id: pedido.requestId,
      p_cliente_id: clienteId,
      p_origem_declarada: pedido.origem,
      p_chave_origem: pedido.chaveOrigem,
      p_linhas: pedido.linhas,
    });
    if (error) throw error;
    const resposta = respostaRecepcaoSchema.parse(data);
    if (resposta.requestId !== pedido.requestId)
      throw new Error("Resposta não corresponde ao pedido.");
    return resposta;
  },
  async consultarReciboRecepcao(atorId: string, clienteId: string, valor: RecepcaoLevantamento) {
    const pedido = validarRecepcaoLevantamento(valor);
    const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_recepcao_manual", {
      p_ator_id: atorId, p_cliente_id: clienteId, p_request_id: pedido.requestId,
      p_origem_declarada: pedido.origem, p_chave_origem: pedido.chaveOrigem, p_linhas: pedido.linhas,
    });
    if (error) throw error;
    const resposta = respostaRecepcaoSchema.parse(data);
    if (resposta.requestId !== pedido.requestId) throw new Error("Recibo divergente.");
    return resposta;
  },
  async reservarRecepcao(atorId: string, clienteId: string, valor: RecepcaoLevantamento) {
    const pedido = validarRecepcaoLevantamento(valor);
    const { data, error } = await supabase.schema("pcm").rpc("sso_reservar_recepcao_manual", {
      p_ator_id: atorId, p_cliente_id: clienteId, p_origem_declarada: pedido.origem,
      p_chave_origem: pedido.chaveOrigem, p_linhas: pedido.linhas,
    });
    if (error) throw error;
    const reserva = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), criaLote: z.literal(false) }).strict().parse(data);
    if (reserva.clienteId !== clienteId) throw new Error("Reserva divergente.");
    return reserva.requestId;
  },
  async cancelarRecepcao(atorId: string, clienteId: string, valor: RecepcaoLevantamento, motivo: string) {
    const pedido = validarRecepcaoLevantamento(valor);
    const { data, error } = await supabase.schema("pcm").rpc("sso_cancelar_recepcao_manual", {
      p_ator_id: atorId, p_cliente_id: clienteId, p_request_id: pedido.requestId,
      p_origem_declarada: pedido.origem, p_chave_origem: pedido.chaveOrigem, p_linhas: pedido.linhas, p_motivo: motivo,
    });
    if (error) throw error;
    const resposta = z.discriminatedUnion("estado", [
      z.object({ estado: z.literal("cancelado"), requestId: z.string().uuid() }).strict(),
      z.object({ estado: z.literal("recebido"), requestId: z.string().uuid(), resultado: respostaRecepcaoSchema }).strict(),
    ]).parse(data);
    if (resposta.requestId !== pedido.requestId || (resposta.estado === "recebido" && resposta.resultado.requestId !== pedido.requestId)) throw new Error("Resposta divergente.");
    return resposta;
  },
  async listarLotes(clienteId: string, limite: number, apos: string | null, signal?: AbortSignal) {
    validarLimite(limite);
    let consulta = supabase
      .schema("pcm")
      .rpc("sso_listar_levantamentos", { p_cliente_id: clienteId, p_limite: limite, p_apos: apos });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return lotesSchema.parse(data).map((lote) => ({
      id: lote.id,
      origem: lote.origem,
      chaveOrigem: lote.chave_origem,
      revisao: lote.revisao,
      criadoEm: lote.criado_em,
    }));
  },
  async listarLinhas(
    clienteId: string,
    loteId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ) {
    validarLimite(limite);
    let consulta = supabase.schema("pcm").rpc("sso_listar_linhas_levantamento", {
      p_cliente_id: clienteId,
      p_lote_id: loteId,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return linhasSchema.parse(data);
  },
};
