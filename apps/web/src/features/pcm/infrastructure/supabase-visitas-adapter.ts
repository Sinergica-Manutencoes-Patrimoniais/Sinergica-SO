import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { CriarVisita, VisitasGateway } from "../application/visitas-gateway";

const resultadoSchema = z.object({
  aggregateId: z.string().uuid(), revision: z.number().int().positive(), state: z.string(),
  created: z.boolean(), linkedIds: z.record(z.string(), z.string().nullable()), warnings: z.array(z.string()),
  requestId: z.string().uuid(),
}).strict();

function resultadoDaVisita(data: unknown, comando: { visitaId: string; requestId: string }) {
  const resultado = resultadoSchema.parse(data);
  if (resultado.aggregateId.toLowerCase() !== comando.visitaId.toLowerCase() ||
      resultado.requestId.toLowerCase() !== comando.requestId.toLowerCase())
    throw new Error("Resposta da Visita não corresponde ao pedido.");
  return resultado;
}

export async function consultarReciboCriacaoVisita(atorId: string, c: CriarVisita) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_recibo_criacao_visita", {
    p_ator_id: atorId, p_request_id: c.requestId, p_expected_revision: c.expectedRevision,
    p_visita_id: c.visitaId, p_cliente_id: c.clienteId, p_contrato_id: c.contratoId,
    p_area_id: c.areaId, p_local_id: c.localId, p_inicio_em: c.inicioEm, p_fim_em: c.fimEm,
    p_fuso: c.fuso, p_natureza: c.natureza, p_responsavel_id: c.responsavelId, p_deslocamento_minutos: c.deslocamentoMinutos,
  });
  if (error) throw error;
  const resultado = resultadoDaVisita(data, c);
  if (!resultado.created || resultado.state !== "rascunho" || resultado.linkedIds.clienteId?.toLowerCase() !== c.clienteId.toLowerCase()) throw new Error("Recibo de criação divergente.");
  return resultado;
}

export async function cancelarCriacaoVisita(atorId: string, c: CriarVisita, motivo: string) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_cancelar_criacao_visita", {
    p_ator_id: atorId, p_request_id: c.requestId, p_expected_revision: c.expectedRevision,
    p_visita_id: c.visitaId, p_cliente_id: c.clienteId, p_contrato_id: c.contratoId,
    p_area_id: c.areaId, p_local_id: c.localId, p_inicio_em: c.inicioEm, p_fim_em: c.fimEm,
    p_fuso: c.fuso, p_natureza: c.natureza, p_responsavel_id: c.responsavelId,
    p_deslocamento_minutos: c.deslocamentoMinutos, p_motivo: motivo,
  });
  if (error) throw error;
  const resposta = z.discriminatedUnion("estado", [
    z.object({ estado: z.literal("cancelada"), requestId: z.string().uuid() }).strict(),
    z.object({ estado: z.literal("criada"), requestId: z.string().uuid(), resultado: resultadoSchema }).strict(),
  ]).parse(data);
  if (resposta.requestId !== c.requestId) throw new Error("Resposta divergente.");
  if (resposta.estado === "criada") {
    const resultado = resultadoDaVisita(resposta.resultado, c);
    if (!resultado.created || resultado.state !== "rascunho" || resultado.linkedIds.clienteId?.toLowerCase() !== c.clienteId.toLowerCase()) throw new Error("Recibo divergente.");
  }
  return resposta;
}

export async function reservarCriacaoVisita(atorId: string, c: CriarVisita): Promise<CriarVisita> {
  const { data, error } = await supabase.schema("pcm").rpc("sso_reservar_criacao_visita", {
    p_ator_id: atorId, p_visita_id: c.visitaId, p_cliente_id: c.clienteId,
    p_contrato_id: c.contratoId, p_area_id: c.areaId, p_local_id: c.localId,
    p_inicio_em: c.inicioEm, p_fim_em: c.fimEm, p_fuso: c.fuso, p_natureza: c.natureza,
    p_responsavel_id: c.responsavelId, p_deslocamento_minutos: c.deslocamentoMinutos,
  });
  if (error) throw error;
  const reserva = z.object({ requestId: z.string().uuid(), visitaId: z.string().uuid(), clienteId: z.string().uuid(), criaVisita: z.literal(false) }).strict().parse(data);
  if (reserva.visitaId !== c.visitaId || reserva.clienteId !== c.clienteId) throw new Error("Reserva divergente.");
  return { ...c, requestId: reserva.requestId };
}

const conferenciaSchema = z.object({
  visitaId: z.string().uuid(), revision: z.number().int().positive(),
  situacao: z.enum(["pendente_pcm", "ciencia_pendente", "ciencia_conferida", "nao_exigida"]),
  politicaModo: z.enum(["sem_controle", "informativa", "obrigatoria"]),
  politicaOrigem: z.enum(["padrao", "cliente", "contrato", "visita"]),
  politicaId: z.string().uuid().nullable(), politicaRevisao: z.number().int().positive().nullable(),
  confirmacaoId: z.string().uuid().nullable(), cienciaEncontrada: z.boolean(), autorizaEnvio: z.literal(false),
}).strict();

const estadoSchema = z.enum(["rascunho", "planejada", "confirmada", "enviada", "em_execucao", "parcial", "concluida", "reprogramada", "cancelada"]);
const naturezaSchema = z.enum(["regular", "extra", "reposicao_manual"]);
const resumoSchema = z.object({ id: z.string().uuid(), cliente_id: z.string().uuid(), inicio_em: z.string(), fim_em: z.string(),
  fuso: z.string(), natureza: naturezaSchema, estado: estadoSchema, revisao: z.number().int().positive(), responsavel_id: z.string().uuid().nullable() }).strict()
  .transform((v) => ({ id: v.id, clienteId: v.cliente_id, inicioEm: v.inicio_em, fimEm: v.fim_em,
    fuso: v.fuso, natureza: v.natureza, estado: v.estado, revisao: v.revisao, responsavelId: v.responsavel_id }));
const detalheSchema = z.object({ id: z.string().uuid(), clienteId: z.string().uuid(), contratoId: z.string().uuid().nullable(),
  areaId: z.string().uuid().nullable(), localId: z.string().uuid().nullable(), inicioEm: z.string(), fimEm: z.string(), fuso: z.string(),
  natureza: naturezaSchema, estado: estadoSchema, responsavelId: z.string().uuid().nullable(), deslocamentoMinutos: z.number().int().nonnegative(),
  revisao: z.number().int().positive(), quantidadeOs: z.number().int().nonnegative(), quantidadeEquipe: z.number().int().nonnegative() }).strict();
const historicoCampos = { id: z.string().uuid(), estimativa_minutos: z.number().int().nonnegative().nullable(), created_at: z.string(),
  encerrado_em: z.string().nullable(), encerrado_por: z.string().uuid().nullable(), encerramento_motivo: z.string().nullable() };
const osSchema = z.object({ ...historicoCampos, os_id: z.string().uuid(), numero: z.string(), titulo: z.string(), categoria: z.string(),
  sequencia: z.number().int().positive() }).strict().transform((v) => ({ id: v.id, osId: v.os_id, numero: v.numero,
  titulo: v.titulo, categoria: v.categoria, sequencia: v.sequencia, estimativaMinutos: v.estimativa_minutos,
  criadoEm: v.created_at, encerradoEm: v.encerrado_em, encerradoPor: v.encerrado_por, encerramentoMotivo: v.encerramento_motivo }));
const membroSchema = z.object({ ...historicoCampos, funcionario_id: z.string().uuid(), nome: z.string(), papel: z.string() }).strict()
  .transform((v) => ({ id: v.id, funcionarioId: v.funcionario_id, nome: v.nome, papel: v.papel, estimativaMinutos: v.estimativa_minutos,
    criadoEm: v.created_at, encerradoEm: v.encerrado_em, encerradoPor: v.encerrado_por, encerramentoMotivo: v.encerramento_motivo }));

export const supabaseVisitasAdapter: VisitasGateway = {
  async selecionarPosicoes(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100) throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_selecionar_posicoes_visita", { p_cliente_id: c.clienteId, p_visita_id: c.visitaId,
      p_tipo: c.tipo, p_area_id: c.areaId, p_busca: c.busca, p_limite: c.limite, p_apos: c.apos });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(z.object({ id: z.string().uuid(), nome: z.string(), area_id: z.string().uuid().nullable() }).strict()
      .transform((v) => ({ id: v.id, nome: v.nome, areaId: v.area_id }))).parse(data);
  },
  async selecionarOs(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100) throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_selecionar_os_visita", { p_cliente_id: c.clienteId, p_visita_id: c.visitaId,
      p_busca: c.busca, p_limite: c.limite, p_apos: c.apos });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(z.object({ id: z.string().uuid(), numero: z.string(), titulo: z.string(), categoria: z.string(), status: z.string() }).strict()).parse(data);
  },
  async selecionarFuncionarios(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100) throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_selecionar_funcionarios_visita", { p_cliente_id: c.clienteId, p_visita_id: c.visitaId,
      p_excluir_vinculados: c.excluirVinculados, p_busca: c.busca, p_limite: c.limite, p_apos: c.apos });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(z.object({ id: z.string().uuid(), nome: z.string() }).strict()).parse(data);
  },
  async listar(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100) throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_visitas", {
      p_cliente_id: c.clienteId, p_inicio: c.inicio, p_fim: c.fim, p_limite: c.limite,
      p_apos_inicio: c.apos?.inicio ?? null, p_apos_id: c.apos?.id ?? null,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    const visitas = z.array(resumoSchema).parse(data);
    if (visitas.some((visita) => visita.clienteId.toLowerCase() !== c.clienteId.toLowerCase()))
      throw new Error("Lista contém Visita de outro Cliente.");
    return visitas;
  },
  async detalhar(clienteId, visitaId, signal) {
    let consulta = supabase.schema("pcm").rpc("sso_detalhar_visita", { p_cliente_id: clienteId, p_visita_id: visitaId });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    const detalhe = detalheSchema.parse(data);
    if (detalhe.id.toLowerCase() !== visitaId.toLowerCase() ||
        detalhe.clienteId.toLowerCase() !== clienteId.toLowerCase())
      throw new Error("Detalhe não corresponde ao Cliente e à Visita consultados.");
    return detalhe;
  },
  async listarOs(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100) throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_os_visita", { p_cliente_id: c.clienteId, p_visita_id: c.visitaId,
      p_incluir_historico: c.incluirHistorico, p_limite: c.limite, p_apos_sequencia: c.apos?.sequencia ?? null, p_apos_id: c.apos?.id ?? null });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(osSchema).parse(data);
  },
  async listarEquipe(c, signal) {
    if (!Number.isSafeInteger(c.limite) || c.limite < 1 || c.limite > 100) throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_equipe_visita", { p_cliente_id: c.clienteId, p_visita_id: c.visitaId,
      p_incluir_historico: c.incluirHistorico, p_limite: c.limite, p_apos_id: c.aposId });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(membroSchema).parse(data);
  },
  async criar(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_criar_visita_rascunho", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
      p_cliente_id: c.clienteId, p_contrato_id: c.contratoId, p_area_id: c.areaId, p_local_id: c.localId,
      p_inicio_em: c.inicioEm, p_fim_em: c.fimEm, p_fuso: c.fuso, p_natureza: c.natureza,
      p_responsavel_id: c.responsavelId, p_deslocamento_minutos: c.deslocamentoMinutos,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async editar(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_editar_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
      p_area_id: c.areaId, p_local_id: c.localId, p_inicio_em: c.inicioEm, p_fim_em: c.fimEm,
      p_fuso: c.fuso, p_responsavel_id: c.responsavelId, p_deslocamento_minutos: c.deslocamentoMinutos,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async associarOs(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_associar_os_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
      p_os_id: c.osId, p_vinculo_id: c.vinculoId, p_sequencia: c.sequencia, p_estimativa_minutos: c.estimativaMinutos,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async adicionarMembro(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_adicionar_membro_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
      p_funcionario_id: c.funcionarioId, p_participacao_id: c.participacaoId, p_papel: c.papel,
      p_estimativa_minutos: c.estimativaMinutos,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async desvincularOs(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_desvincular_os_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
      p_vinculo_id: c.vinculoId, p_motivo: c.motivo,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async encerrarMembro(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_encerrar_membro_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
      p_participacao_id: c.participacaoId, p_motivo: c.motivo,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async planejar(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_planejar_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async configurarCiencia(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_configurar_ciencia_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_politica_id: c.politicaId,
      p_cliente_id: c.clienteId, p_contrato_id: c.contratoId, p_visita_id: c.visitaId, p_modo: c.modo,
    });
    if (error) throw error;
    return resultadoSchema.parse(data);
  },
  async confirmar(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_confirmar_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async registrarCiencia(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_registrar_ciencia_visita", {
      p_request_id: c.requestId, p_expected_revision: c.expectedRevision, p_visita_id: c.visitaId,
      p_ciencia_em: c.cienciaEm, p_responsavel: c.responsavel, p_canal: c.canal, p_observacao: c.observacao,
    });
    if (error) throw error;
    return resultadoDaVisita(data, c);
  },
  async conferirCiencia(visitaId) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_ciencia_visita", { p_visita_id: visitaId });
    if (error) throw error;
    const conferencia = conferenciaSchema.parse(data);
    if (conferencia.visitaId.toLowerCase() !== visitaId.toLowerCase())
      throw new Error("Conferência não corresponde à Visita consultada.");
    return conferencia;
  },
};
