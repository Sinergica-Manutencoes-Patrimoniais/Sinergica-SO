// infrastructure/supabase-plano-pmoc-adapter.ts — E01-S203.
//
// Conversa com as três RPCs da migration 1871:
//   pcm.sso_listar_contratos_pmoc_sem_plano   — o que ainda falta
//   pcm.sso_resumir_cobertura_plano_pmoc      — quanto falta
//   pcm.sso_criar_plano_do_contrato_pmoc      — a criação, SEMPRE com confirmação humana
// Todas recusam com erro NOMEADO (gate fechado, sem capacidade, contrato já convertido). O erro
// sobe cru daqui para a tela decidir a frase — nunca vira lista vazia nem `null`.
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { CoberturaPlanoPmoc, ContratoPmocSemPlano } from "../domain/plano-pmoc-manual";

const uuid = z.string().guid();

const contratoSchema = z
  .object({
    contrato_id: uuid,
    imovel_id: uuid,
    imovel_nome: z.string(),
    imovel_cidade: z.string().nullable(),
    art_numero: z.string().nullable(),
    vigencia_inicio: z.string(),
    vigencia_fim: z.string(),
    status: z.string(),
    equipamentos_ativos: z.number().int(),
    agendamentos: z.number().int(),
    periodicidades: z.array(z.string()).nullable(),
  })
  .strict();

const coberturaSchema = z
  .object({
    cliente_id: uuid,
    contratos_total: z.number().int(),
    contratos_com_plano: z.number().int(),
    contratos_sem_plano: z.number().int(),
    planos_modalidade_pmoc: z.number().int(),
    contratos_sem_cliente: z.number().int(),
  })
  .strict();

const reciboSchema = z
  .object({
    requestId: uuid,
    planoId: uuid,
    vinculoId: uuid,
    contratoPmocId: uuid,
    clienteId: uuid,
    nome: z.string(),
    modalidade: z.literal("pmoc"),
    estado: z.literal("rascunho"),
    revisao: z.literal(1),
    criadoPorHumano: z.literal(true),
    rotinasCriadas: z.literal(0),
    contratoPmocPreservado: z.literal(true),
  })
  .passthrough();

export interface ReciboPlanoPmoc {
  requestId: string;
  planoId: string;
  vinculoId: string;
  contratoPmocId: string;
  clienteId: string;
  nome: string;
}

export async function listarContratosPmocSemPlano(
  clienteId: string,
  signal?: AbortSignal,
): Promise<ContratoPmocSemPlano[]> {
  const ator = await exigirAtor(signal);
  if (!uuid.safeParse(clienteId).success) throw new Error("Cliente inválido.");
  let chamada = supabase.schema("pcm").rpc("sso_listar_contratos_pmoc_sem_plano", {
    p_ator_id: ator,
    p_cliente_id: clienteId,
    p_limite: 200,
  });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  const linhas = contratoSchema.array().safeParse(data ?? []);
  if (!linhas.success) throw new Error("Lista de Contratos PMOC em formato inesperado.");
  return linhas.data.map((linha) => ({
    contratoId: linha.contrato_id,
    imovelId: linha.imovel_id,
    imovelNome: linha.imovel_nome,
    imovelCidade: linha.imovel_cidade,
    artNumero: linha.art_numero,
    vigenciaInicio: linha.vigencia_inicio,
    vigenciaFim: linha.vigencia_fim,
    status: linha.status,
    equipamentosAtivos: linha.equipamentos_ativos,
    agendamentos: linha.agendamentos,
    periodicidades: linha.periodicidades ?? [],
  }));
}

export async function resumirCoberturaPlanoPmoc(
  clienteId: string,
  signal?: AbortSignal,
): Promise<CoberturaPlanoPmoc> {
  const ator = await exigirAtor(signal);
  if (!uuid.safeParse(clienteId).success) throw new Error("Cliente inválido.");
  let chamada = supabase.schema("pcm").rpc("sso_resumir_cobertura_plano_pmoc", {
    p_ator_id: ator,
    p_cliente_id: clienteId,
  });
  if (signal) chamada = chamada.abortSignal(signal);
  const { data, error } = await chamada;
  if (error) throw error;
  const linha = coberturaSchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!linha.success) throw new Error("Resumo de cobertura PMOC em formato inesperado.");
  return {
    clienteId: linha.data.cliente_id,
    contratosTotal: linha.data.contratos_total,
    contratosComPlano: linha.data.contratos_com_plano,
    contratosSemPlano: linha.data.contratos_sem_plano,
    planosModalidadePmoc: linha.data.planos_modalidade_pmoc,
    contratosSemCliente: linha.data.contratos_sem_cliente,
  };
}

/** A criação. `confirmaCriacao` é sempre `true` porque esta função só é chamada a partir de um
 * clique com confirmação na tela — a RPC recusa qualquer outra coisa (`criacao_nao_confirmada`),
 * que é a trava da decisão (b) da ADR-1698: Plano PMOC nunca nasce sozinho. */
export async function criarPlanoDoContratoPmoc(comando: {
  requestId: string;
  clienteId: string;
  contratoPmocId: string;
  nome: string | null;
}): Promise<ReciboPlanoPmoc> {
  const ator = await exigirAtor();
  if (
    !uuid.safeParse(comando.requestId).success ||
    !uuid.safeParse(comando.clienteId).success ||
    !uuid.safeParse(comando.contratoPmocId).success
  )
    throw new Error("Pedido de criação inválido.");
  const nome = comando.nome?.trim() ? comando.nome.trim().slice(0, 200) : null;
  const { data, error } = await supabase.schema("pcm").rpc("sso_criar_plano_do_contrato_pmoc", {
    p_ator_id: ator,
    p_request_id: comando.requestId,
    p_cliente_id: comando.clienteId,
    p_contrato_pmoc_id: comando.contratoPmocId,
    p_nome: nome,
    p_confirma_criacao: true,
  });
  if (error) throw error;
  const recibo = reciboSchema.safeParse(data);
  if (!recibo.success) throw new Error("Recibo de criação de Plano PMOC inesperado.");
  // O recibo tem de falar do MESMO pedido: recibo divergente é falha, nunca sucesso silencioso.
  if (
    recibo.data.requestId !== comando.requestId ||
    recibo.data.contratoPmocId !== comando.contratoPmocId ||
    recibo.data.clienteId !== comando.clienteId
  )
    throw new Error("Recibo de criação de Plano PMOC divergente.");
  return {
    requestId: recibo.data.requestId,
    planoId: recibo.data.planoId,
    vinculoId: recibo.data.vinculoId,
    contratoPmocId: recibo.data.contratoPmocId,
    clienteId: recibo.data.clienteId,
    nome: recibo.data.nome,
  };
}

/** As RPCs de 1871 exigem `p_ator_id = auth.uid()` (herdado de `sso_conferir_pmoc_mediado`).
 * Ler a sessão aqui evita mandar um ator chutado e receber `sem_acesso` sem saber por quê. */
async function exigirAtor(signal?: AbortSignal): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id || signal?.aborted) throw new Error("Sessão indisponível.");
  return data.user.id;
}
