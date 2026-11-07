import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type {
  AdicionarRotinaCompletaGateway,
  AdicionarRotinaGateway,
  ConsultarAlvosPlanoGateway,
  ConsultarCiclosGateway,
  ConsultarPlanosGateway,
  ConsultarPreviaRevisaoGateway,
  ConsultarPreviaRevisionadaGateway,
  ConsultarQuestionarioAprovadoGateway,
  ConsultarRotinasGateway,
  ConsultarVersoesGateway,
  EditarRotinaCommand,
  EditarRotinaGateway,
  RetirarRotinaGateway,
  RevisarPlanoGateway,
  RotinaCommand,
  SalvarPlanoGateway,
} from "../application/plano-manutencao-gateway";

const resultadoSchema = z
  .object({
    aggregateId: z.string().uuid(),
    revision: z.number().int().positive(),
    state: z.string(),
    created: z.boolean(),
    linkedIds: z.record(z.string(), z.string()),
    warnings: z.array(
      z.union([
        z.string(),
        z.object({ rotinaId: z.string().uuid(), pendencias: z.array(z.string()) }).strict(),
      ]),
    ),
    requestId: z.string().uuid(),
  })
  .strict();
async function executar(
  nome: string,
  parametros: Record<string, string | number | boolean | null>,
) {
  const { data, error } = await supabase.schema("pcm").rpc(nome, parametros);
  if (error) throw error;
  return resultadoSchema.parse(data);
}

export async function prepararAprovacaoVersao(
  userId: string,
  clienteId: string,
  planoId: string,
  revision: number,
) {
  const { data, error } = await supabase.schema("pcm").rpc("sso_preparar_aprovacao_versao", {
    p_ator: userId,
    p_cliente: clienteId,
    p_plano: planoId,
    p_revisao: revision,
  });
  if (error) throw error;
  const resultado = z
    .object({
      planoId: z.string().uuid(),
      clienteId: z.string().uuid(),
      revision: z.number().int().positive(),
      versaoId: z.string().uuid(),
    })
    .strict()
    .parse(data);
  if (
    resultado.planoId !== planoId ||
    resultado.clienteId !== clienteId ||
    resultado.revision !== revision
  )
    throw new Error("Preparação divergente.");
  return resultado.versaoId;
}

export function aprovarVersaoEsperada(
  c: { requestId: string; expectedRevision: number; planoId: string; vigencia: string },
  contexto: { userId: string; clienteId: string; versaoId: string; revisaoPreparada: boolean },
) {
  return executar("sso_aprovar_versao_esperada", {
    p_ator: contexto.userId,
    p_cliente: contexto.clienteId,
    p_request: c.requestId,
    p_revisao: c.expectedRevision,
    p_plano: c.planoId,
    p_versao: contexto.versaoId,
    p_vigencia: c.vigencia,
    p_revisao_preparada: contexto.revisaoPreparada,
  });
}

// A mediação possui gate desligado e a aprovação permanece bloqueada pela guarda de impactos.
export function aprovarRevisaoPreparada(
  c: { requestId: string; expectedRevision: number; planoId: string; vigencia: string },
  contexto: { userId: string; clienteId: string },
) {
  return executar("sso_aprovar_revisao_mediada", {
    p_ator_id: contexto.userId,
    p_cliente_id: contexto.clienteId,
    p_request_id: c.requestId,
    p_expected_revision: c.expectedRevision,
    p_plano_id: c.planoId,
    p_vigencia: c.vigencia,
  });
}
function parametrosRotina(c: RotinaCommand) {
  return {
    p_request_id: c.requestId,
    p_expected_revision: c.expectedRevision,
    p_plano_id: c.planoId,
    p_rotina_id: c.rotinaId,
    p_nome: c.nome,
    p_alvo_tipo: c.alvoTipo,
    p_alvo_id: c.alvoId,
    p_modo: c.modo,
    p_intervalo: c.intervalo,
    p_unidade: c.unidade,
    p_data_base: c.dataBase,
    p_tempo_minutos: c.tempoMinutos,
  };
}
function parametrosCompletos(c: EditarRotinaCommand) {
  return {
    ...parametrosRotina(c),
    p_tolerancia_antes: c.toleranciaAntes,
    p_tolerancia_depois: c.toleranciaDepois,
    p_instrucao: c.instrucao,
    p_questionario_id: c.questionarioId,
    p_tipo_tempo: c.tipoTempo,
  };
}
export const supabasePlanoManutencaoAdapter: SalvarPlanoGateway &
  AdicionarRotinaGateway &
  AdicionarRotinaCompletaGateway &
  EditarRotinaGateway &
  ConsultarPlanosGateway &
  ConsultarRotinasGateway &
  RevisarPlanoGateway &
  RetirarRotinaGateway &
  ConsultarVersoesGateway &
  ConsultarCiclosGateway &
  ConsultarQuestionarioAprovadoGateway &
  ConsultarPreviaRevisaoGateway &
  ConsultarPreviaRevisionadaGateway &
  ConsultarAlvosPlanoGateway = {
  async preverRevisaoRevisionada(planoId, revisao, limite, apos, signal) {
    if (
      !Number.isSafeInteger(revisao) ||
      revisao < 1 ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100
    )
      throw new Error("Consulta inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_previa_revisao_revisionada", {
      p_plano_id: planoId,
      p_revisao: revisao,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    const uuid = z.string().uuid();
    const campos = z
      .object({
        id: uuid,
        nome: z.string(),
        alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
        sistema_id: uuid.nullable(),
        equipamento_id: uuid.nullable(),
        grupo_id: uuid.nullable(),
        modo: z.enum(["calendario", "visita"]),
        intervalo_n: z.number().int().positive().nullable(),
        intervalo_unidade: z.enum(["dias", "semanas", "meses", "anos"]).nullable(),
        data_base: z.string().date().nullable(),
        tempo_minutos: z.number().int().nonnegative().nullable(),
        tipo_tempo: z.enum(["total", "por_unidade"]).nullable(),
        tolerancia_antes: z.number().int().nonnegative(),
        tolerancia_depois: z.number().int().nonnegative(),
        instrucao: z.string().nullable(),
        questionario_id: uuid.nullable(),
      })
      .strict();
    const resultado = z
      .object({
        revision: z.number().int().positive(),
        versaoAnteriorId: uuid,
        versaoRascunhoId: uuid,
        nextCursor: uuid.nullable(),
        impactosOperacionaisPendentes: z.literal(true),
        items: z.array(
          z
            .object({
              rotinaLogicaId: uuid,
              classificacao: z.enum([
                "adicionada",
                "retirada",
                "alterada",
                "inalterada",
                "questionario_indeterminado",
              ]),
              questionarioConteudoPendente: z.boolean(),
              anterior: campos.nullable(),
              rascunho: campos.nullable(),
            })
            .strict(),
        ),
      })
      .strict()
      .parse(data);
    if (
      resultado.revision !== revisao ||
      resultado.versaoAnteriorId.toLowerCase() === resultado.versaoRascunhoId.toLowerCase() ||
      resultado.items.length > limite
    )
      throw new Error("Prévia fora do contexto solicitado.");
    let anterior = apos?.toLowerCase() ?? null;
    for (const item of resultado.items) {
      const atual = item.rotinaLogicaId.toLowerCase();
      if (anterior !== null && atual <= anterior)
        throw new Error("Paginação da prévia divergente.");
      anterior = atual;
    }
    if (
      resultado.nextCursor !== null &&
      (resultado.items.length !== limite || resultado.nextCursor.toLowerCase() !== anterior)
    )
      throw new Error("Cursor da prévia divergente.");
    return resultado;
  },
  retirarRotina: (c) =>
    executar("sso_retirar_rotina_rascunho", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_plano_id: c.planoId,
      p_rotina_id: c.rotinaId,
      p_motivo: c.motivo,
    }),
  async preverRevisao(planoId, limite, apos, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase
      .schema("pcm")
      .rpc("sso_previa_revisao_plano", { p_plano_id: planoId, p_limite: limite, p_apos: apos });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z
      .array(
        z
          .object({
            rotina_logica_id: z.string().uuid(),
            rotina_anterior_id: z.string().uuid().nullable(),
            rotina_rascunho_id: z.string().uuid().nullable(),
            nome_anterior: z.string().nullable(),
            nome_rascunho: z.string().nullable(),
            classificacao: z.enum(["adicionada", "retirada", "alterada", "inalterada"]),
            revisao: z.number().int().positive(),
            impactos_operacionais_pendentes: z.literal(true),
          })
          .transform((r) => ({
            rotinaLogicaId: r.rotina_logica_id,
            rotinaAnteriorId: r.rotina_anterior_id,
            rotinaRascunhoId: r.rotina_rascunho_id,
            nomeAnterior: r.nome_anterior,
            nomeRascunho: r.nome_rascunho,
            classificacao: r.classificacao,
            revisao: r.revisao,
            impactosOperacionaisPendentes: r.impactos_operacionais_pendentes,
          })),
      )
      .parse(data);
  },
  async consultarQuestionarioAprovado(planoId, versaoId, rotinaId, signal) {
    let consulta = supabase.schema("pcm").rpc("sso_questionario_rotina_aprovada", {
      p_plano_id: planoId,
      p_versao_id: versaoId,
      p_rotina_id: rotinaId,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    const resultado = z
      .object({
        rotinaId: z.string().uuid(),
        versaoId: z.string().uuid(),
        questionario: z
          .object({
            id: z.string().uuid(),
            nome: z.string(),
            cabecalho: z.string().nullable(),
            rodape: z.string().nullable(),
            perguntas: z.array(z.unknown()),
          })
          .strict()
          .nullable(),
      })
      .strict()
      .parse(data);
    if (resultado.rotinaId !== rotinaId || resultado.versaoId !== versaoId)
      throw new Error("Questionário retornado fora do contexto solicitado.");
    return resultado;
  },
  async preverCiclos(planoId, versaoId, rotinaId, inicio, fim, signal) {
    let consulta = supabase.schema("pcm").rpc("sso_prever_ciclos_rotina", {
      p_plano_id: planoId,
      p_versao_id: versaoId,
      p_rotina_id: rotinaId,
      p_inicio: inicio,
      p_fim: fim,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z
      .array(
        z
          .object({
            ciclo: z.number().int().nonnegative(),
            vencimento: z.string().date(),
            tolerancia_antes: z.number().int().nonnegative(),
            tolerancia_depois: z.number().int().nonnegative(),
          })
          .transform((r) => ({
            ciclo: r.ciclo,
            vencimento: r.vencimento,
            toleranciaAntes: r.tolerancia_antes,
            toleranciaDepois: r.tolerancia_depois,
          })),
      )
      .parse(data);
  },
  async listarAlvos(planoId, tipo, limite, apos, busca, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_alvos_plano", {
      p_plano_id: planoId,
      p_tipo: tipo,
      p_limite: limite,
      p_apos: apos,
      p_busca: busca,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(z.object({ id: z.string().uuid(), nome: z.string() })).parse(data);
  },
  async listarVersoes(planoId, limite, apos, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase
      .schema("pcm")
      .from("plano_versoes")
      .select("id,plano_id,numero,estado,vigencia_inicio,vigencia_fim")
      .eq("plano_id", planoId);
    if (apos) consulta = consulta.gt("id", apos);
    let pagina = consulta.order("id", { ascending: true }).limit(limite);
    if (signal) pagina = pagina.abortSignal(signal);
    const { data, error } = await pagina;
    if (error) throw error;
    return z
      .array(
        z
          .object({
            id: z.string().uuid(),
            plano_id: z.string().uuid(),
            numero: z.number().int().positive(),
            estado: z.enum(["rascunho", "aprovado"]),
            vigencia_inicio: z.string().nullable(),
            vigencia_fim: z.string().nullable(),
          })
          .transform((v) => ({
            id: v.id,
            planoId: v.plano_id,
            numero: v.numero,
            estado: v.estado,
            vigenciaInicio: v.vigencia_inicio,
            vigenciaFim: v.vigencia_fim,
          })),
      )
      .parse(data);
  },
  async listarRotinas(planoId, versaoId, limite, apos, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_rotinas_plano", {
      p_plano_id: planoId,
      p_versao_id: versaoId,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    const schema = z
      .object({
        id: z.string().uuid(),
        plano_id: z.string().uuid(),
        versao_id: z.string().uuid(),
        nome: z.string(),
        alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
        sistema_id: z.string().uuid().nullable(),
        equipamento_id: z.string().uuid().nullable(),
        grupo_id: z.string().uuid().nullable(),
        modo: z.enum(["calendario", "visita"]),
        intervalo_n: z.number().int().positive().nullable(),
        intervalo_unidade: z.enum(["dias", "semanas", "meses", "anos"]).nullable(),
        data_base: z.string().nullable(),
        tempo_minutos: z.number().int().nonnegative().nullable(),
        tipo_tempo: z.enum(["total", "por_unidade"]).nullable(),
        tolerancia_antes: z.number().int().nonnegative(),
        tolerancia_depois: z.number().int().nonnegative(),
        instrucao: z.string().nullable(),
        questionario_id: z.string().uuid().nullable(),
        alvo_nome: z.string().nullable(),
        alvo_ativo: z.boolean(),
        questionario_nome: z.string().nullable(),
      })
      .refine(
        (r) =>
          [r.sistema_id, r.equipamento_id, r.grupo_id].filter(Boolean).length === 1 &&
          Boolean(
            r.alvo_tipo === "sistema"
              ? r.sistema_id
              : r.alvo_tipo === "componente"
                ? r.equipamento_id
                : r.grupo_id,
          ),
        "Alvo inconsistente.",
      )
      .transform((r) => ({
        id: r.id,
        planoId: r.plano_id,
        versaoId: r.versao_id,
        nome: r.nome,
        alvoTipo: r.alvo_tipo,
        alvoId: (r.alvo_tipo === "sistema"
          ? r.sistema_id
          : r.alvo_tipo === "componente"
            ? r.equipamento_id
            : r.grupo_id) as string,
        alvoNome: r.alvo_nome,
        alvoAtivo: r.alvo_ativo,
        questionarioNome: r.questionario_nome,
        modo: r.modo,
        intervalo: r.intervalo_n,
        unidade: r.intervalo_unidade,
        dataBase: r.data_base,
        tempoMinutos: r.tempo_minutos,
        tipoTempo: r.tipo_tempo,
        toleranciaAntes: r.tolerancia_antes,
        toleranciaDepois: r.tolerancia_depois,
        instrucao: r.instrucao,
        questionarioId: r.questionario_id,
      }));
    return z.array(schema).parse(data);
  },
  async listarPlanos(clienteId, limite, apos, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase
      .schema("pcm")
      .from("planos_manutencao")
      .select("id,cliente_id,nome,estado,revisao")
      .eq("cliente_id", clienteId);
    if (apos) consulta = consulta.gt("id", apos);
    let pagina = consulta.order("id", { ascending: true }).limit(limite);
    if (signal) pagina = pagina.abortSignal(signal);
    const { data, error } = await pagina;
    if (error) throw error;
    return z
      .array(
        z
          .object({
            id: z.string().uuid(),
            cliente_id: z.string().uuid(),
            nome: z.string(),
            estado: z.enum([
              "rascunho",
              "em_revisao",
              "aprovado",
              "ativo",
              "suspenso",
              "encerrado",
            ]),
            revisao: z.number().int().positive(),
          })
          .transform((p) => ({
            id: p.id,
            clienteId: p.cliente_id,
            nome: p.nome,
            estado: p.estado,
            revisao: p.revisao,
          })),
      )
      .parse(data);
  },
  salvarPlano: (c) =>
    executar("sso_salvar_plano_rascunho", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_plano_id: c.planoId,
      p_cliente_id: c.clienteId,
      p_nome: c.nome,
    }),
  adicionarRotina: (c) => executar("sso_adicionar_rotina_rascunho", parametrosRotina(c)),
  adicionarRotinaCompleta: (c) =>
    executar("sso_adicionar_rotina_rascunho_v2", parametrosCompletos(c)),
  editarRotina: (c) => executar("sso_editar_rotina_rascunho_v2", parametrosCompletos(c)),
  iniciarRevisao: (c) =>
    executar("sso_iniciar_revisao_plano", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_plano_id: c.planoId,
      p_nova_versao_id: c.novaVersaoId,
    }),
  transicionarRevisao: (c) =>
    executar("sso_transicionar_revisao_plano", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_plano_id: c.planoId,
      p_acao: c.acao,
    }),
  aprovarPlano: (c) =>
    executar("sso_aprovar_plano", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_plano_id: c.planoId,
      p_vigencia: c.vigencia,
    }),
};
