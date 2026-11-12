import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";

// Os 7 estados do §8.2 do Caderno. `aguardando_aquisicao`, `dispensada` e `concluida` entraram
// com a migration 1843 — até ela o banco só aceitava os 4 primeiros.
const estadoSchema = z.enum([
  "levantada",
  "aguardando_aquisicao",
  "informada_disponivel",
  "parcial",
  "indisponivel",
  "dispensada",
  "concluida",
]);
const observacaoOpcional = z
  .string()
  .refine((v) => v.trim().length > 0 && v.length <= 4000)
  .optional();
const eventoDados = z.discriminatedUnion("tipo", [
  z
    .object({
      tipo: z.literal("disponibilidade"),
      dados: z
        .object({ situacao: z.enum(["informada_disponivel", "parcial", "indisponivel"]) })
        .strict(),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("excecao"),
      dados: z
        .object({
          motivo: z.enum(["faltante", "parcial", "errado", "novo_levantamento"]),
          descricao: z.string().refine((v) => v.trim().length > 0 && v.length <= 4000),
          revisaoLinhas: z.number().int().positive().optional(),
          posicao: z.number().int().nonnegative().optional(),
        })
        .strict()
        .refine((v) => (v.revisaoLinhas === undefined) === (v.posicao === undefined)),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("aquisicao"),
      dados: z.object({ observacao: observacaoOpcional }).strict(),
    })
    .strict(),
  z
    .object({
      // Motivo obrigatório: dispensar é decisão, e decisão sem motivo não é auditável.
      tipo: z.literal("dispensa"),
      dados: z
        .object({ motivo: z.string().refine((v) => v.trim().length > 0 && v.length <= 4000) })
        .strict(),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("conclusao"),
      dados: z.object({ observacao: observacaoOpcional }).strict(),
    })
    .strict(),
]);
// Estado que cada evento produz, segundo a matriz de transição da migration 1843. O adapter
// confere isso contra o que o banco devolveu — divergência significa que uma das duas pontas
// mudou sozinha.
const estadoPorEvento = {
  excecao: "levantada",
  aquisicao: "aguardando_aquisicao",
  dispensa: "dispensada",
  conclusao: "concluida",
} as const;
const informarSchema = z
  .object({
    requestId: z.string().guid(),
    listaId: z.string().guid(),
    expectedRevision: z.number().int().positive(),
    evento: eventoDados,
  })
  .strict();
export type InformarMaterial = z.infer<typeof informarSchema>;
export const validarInformarMaterial = (entrada: unknown) => informarSchema.parse(entrada);

const linhasSchema = z
  .array(
    z
      .object({
        descricao: z.string().refine((v) => v.trim().length > 0 && v.length <= 4000),
        quantidade: z
          .string()
          .refine((v) => v.trim().length > 0 && v.length <= 200)
          .nullable(),
        unidade: z
          .string()
          .refine((v) => v.trim().length > 0 && v.length <= 200)
          .nullable(),
        trechosOriginais: z.array(z.string().min(1)).min(1).max(1000),
      })
      .strict(),
  )
  .max(1000);
const comandoLinhasSchema = z
  .object({
    requestId: z.string().guid(),
    listaId: z.string().guid(),
    expectedRevision: z.number().int().positive(),
    linhas: linhasSchema,
  })
  .strict();
export type SalvarLinhasMateriais = z.infer<typeof comandoLinhasSchema>;
export const validarSalvarLinhasMateriais = (entrada: unknown) =>
  comandoLinhasSchema.parse(entrada);

const listaSchema = z
  .object({
    id: z.string().guid(),
    ordem_servico_id: z.string().guid(),
    responsavel: z.enum(["cliente", "sinergica"]),
    texto_original: z.string().min(1),
    estado: estadoSchema,
    revisao: z.number().int().positive(),
  })
  .strict();
const comandoSchema = z
  .object({
    requestId: z.string().guid(),
    expectedRevision: z.literal(0),
    listaId: z.string().guid(),
    ordemServicoId: z.string().guid(),
    responsavel: z.enum(["cliente", "sinergica"]),
    textoOriginal: z
      .string()
      .refine((v) => v.trim().length > 0 && new TextEncoder().encode(v).length <= 65536),
  })
  .strict();
export type CriarListaMateriais = z.infer<typeof comandoSchema>;
export const validarCriarListaMateriais = (entrada: unknown) => comandoSchema.parse(entrada);
const resultadoSchema = z
  .object({
    aggregateId: z.string().guid(),
    revision: z.literal(1),
    state: z.literal("levantada"),
    created: z.literal(true),
    linkedIds: z.object({ ordemServicoId: z.string().guid() }).strict(),
    warnings: z.array(z.string()),
    requestId: z.string().guid(),
  })
  .strict();

export const supabaseListasMateriaisAdapter = {
  async consultarCentralPorSituacao(
    clienteId: string,
    ordemServicoId: string | null,
    responsavel: "cliente" | "sinergica" | null,
    estado: z.infer<typeof estadoSchema> | null,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ) {
    if (
      !z.string().guid().safeParse(clienteId).success ||
      (ordemServicoId !== null && !z.string().guid().safeParse(ordemServicoId).success) ||
      (responsavel !== null && !["cliente", "sinergica"].includes(responsavel)) ||
      (estado !== null && !estadoSchema.safeParse(estado).success) ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100 ||
      (apos !== null && !z.string().guid().safeParse(apos).success)
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase.schema("pcm").rpc("sso_consultar_central_materiais_situacao", {
      p_cliente_id: clienteId,
      p_ordem_servico_id: ordemServicoId,
      p_responsavel: responsavel,
      p_estado: estado,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const pagina = z.array(listaSchema).max(limite).parse(data);
    let anterior = apos?.toLowerCase() ?? null;
    for (const lista of pagina) {
      if (
        (ordemServicoId && lista.ordem_servico_id.toLowerCase() !== ordemServicoId.toLowerCase()) ||
        (responsavel && lista.responsavel !== responsavel) ||
        (estado && lista.estado !== estado) ||
        (anterior !== null && lista.id.toLowerCase() <= anterior)
      )
        throw new Error("Página inválida.");
      anterior = lista.id.toLowerCase();
    }
    return pagina;
  },
  async buscarOsCentral(
    clienteId: string,
    busca: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ) {
    if (
      !z.string().guid().safeParse(clienteId).success ||
      busca.length > 80 ||
      !Number.isInteger(limite) ||
      limite < 1 ||
      limite > 50 ||
      (apos !== null && !z.string().guid().safeParse(apos).success)
    ) {
      throw new Error("Parâmetros inválidos.");
    }
    let query = supabase.schema("pcm").rpc("sso_buscar_os_central_materiais", {
      p_cliente_id: clienteId,
      p_busca: busca,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const pagina = z
      .array(z.object({ id: z.string().guid(), numero: z.string(), titulo: z.string() }).strict())
      .max(limite)
      .parse(data);
    let anterior = apos?.toLowerCase() ?? null;
    for (const item of pagina) {
      if (anterior !== null && item.id.toLowerCase() <= anterior)
        throw new Error("Página divergente.");
      anterior = item.id.toLowerCase();
    }
    return pagina;
  },
  async consultarCentral(
    clienteId: string,
    ordemServicoId: string | null,
    responsavel: "cliente" | "sinergica" | null,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ) {
    if (
      !z.string().guid().safeParse(clienteId).success ||
      (ordemServicoId !== null && !z.string().guid().safeParse(ordemServicoId).success) ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100 ||
      (apos !== null && !z.string().guid().safeParse(apos).success)
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase.schema("pcm").rpc("sso_consultar_central_materiais_mediada", {
      p_cliente_id: clienteId,
      p_ordem_servico_id: ordemServicoId,
      p_responsavel: responsavel,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const listas = z.array(listaSchema).parse(data);
    if (listas.length > limite) throw new Error("Página inválida.");
    let anterior = apos?.toLowerCase() ?? null;
    for (const lista of listas) {
      if (
        (ordemServicoId && lista.ordem_servico_id.toLowerCase() !== ordemServicoId.toLowerCase()) ||
        (responsavel && lista.responsavel !== responsavel) ||
        (anterior && lista.id.toLowerCase() <= anterior)
      )
        throw new Error("Página inválida.");
      anterior = lista.id.toLowerCase();
    }
    return listas;
  },
  async obterSnapshot(listaId: string, revisao: number, signal?: AbortSignal) {
    if (
      !z.string().guid().safeParse(listaId).success ||
      !Number.isSafeInteger(revisao) ||
      revisao < 1
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase
      .schema("pcm")
      .rpc("sso_obter_snapshot_linhas_materiais", { p_lista_id: listaId, p_revisao: revisao });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (data === null) return null;
    const snapshot = z
      .object({ revisao: z.number().int().min(2), linhas: linhasSchema })
      .strict()
      .parse(data);
    if (snapshot.revisao > revisao) throw new Error("Revisão inválida.");
    return snapshot;
  },
  async informar(entrada: InformarMaterial) {
    const comando = validarInformarMaterial(entrada);
    const { data, error } = await supabase.schema("pcm").rpc("sso_informar_material_mediado", {
      p_request_id: comando.requestId,
      p_lista_id: comando.listaId,
      p_expected_revision: comando.expectedRevision,
      p_tipo: comando.evento.tipo,
      p_dados: comando.evento.dados,
    });
    if (error) throw error;
    const resultado = z
      .object({
        aggregateId: z.string().guid(),
        revision: z.number().int().positive(),
        state: estadoSchema,
        created: z.literal(false),
        linkedIds: z.object({}).strict(),
        warnings: z.array(z.string()),
        requestId: z.string().guid(),
      })
      .strict()
      .parse(data);
    const estadoEsperado =
      comando.evento.tipo === "disponibilidade"
        ? comando.evento.dados.situacao
        : estadoPorEvento[comando.evento.tipo];
    if (
      resultado.aggregateId !== comando.listaId ||
      resultado.requestId !== comando.requestId ||
      resultado.revision !== comando.expectedRevision + 1 ||
      resultado.state !== estadoEsperado
    )
      throw new Error("Resposta inconsistente.");
    return resultado;
  },
  async listarEventos(listaId: string, limite: number, apos: number, signal?: AbortSignal) {
    if (
      !z.string().guid().safeParse(listaId).success ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100 ||
      !Number.isSafeInteger(apos) ||
      apos < 0
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase
      .schema("pcm")
      .rpc("sso_listar_eventos_materiais", { p_lista_id: listaId, p_limite: limite, p_apos: apos });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const eventos = z
      .array(
        z
          .object({
            revisao: z.number().int().positive(),
            tipo: z.enum(["disponibilidade", "excecao", "aquisicao", "dispensa", "conclusao"]),
            dados: z.unknown(),
            ator_id: z.string().guid(),
            criado_em: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .parse(data);
    let anterior = apos;
    if (eventos.length > limite) throw new Error("Página inválida.");
    for (const evento of eventos) {
      if (evento.revisao <= anterior) throw new Error("Página inválida.");
      anterior = evento.revisao;
      eventoDados.parse({ tipo: evento.tipo, dados: evento.dados });
    }
    return eventos;
  },
  async obterLinhas(listaId: string, revisao: number, signal?: AbortSignal) {
    if (
      !z.string().guid().safeParse(listaId).success ||
      !Number.isSafeInteger(revisao) ||
      revisao < 1
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase
      .schema("pcm")
      .rpc("sso_obter_linhas_materiais_vigentes", { p_lista_id: listaId, p_revisao: revisao });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (data === null) return null;
    return linhasSchema.parse(data);
  },
  async obterLinhasExatas(listaId: string, revisao: number, signal?: AbortSignal) {
    if (
      !z.string().guid().safeParse(listaId).success ||
      !Number.isSafeInteger(revisao) ||
      revisao < 2
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase
      .schema("pcm")
      .rpc("sso_obter_linhas_materiais", { p_lista_id: listaId, p_revisao: revisao });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    if (data === null) throw new Error("Versão histórica indisponível.");
    return linhasSchema.parse(data);
  },
  async salvarLinhas(entrada: SalvarLinhasMateriais) {
    const comando = validarSalvarLinhasMateriais(entrada);
    if (new TextEncoder().encode(JSON.stringify(comando.linhas)).length > 262144)
      throw new Error("Linhas excedem limite.");
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("sso_salvar_linhas_materiais_mediada", {
        p_request_id: comando.requestId,
        p_lista_id: comando.listaId,
        p_expected_revision: comando.expectedRevision,
        p_linhas: comando.linhas,
      });
    if (error) throw error;
    const resultado = z
      .object({
        aggregateId: z.string().guid(),
        revision: z.number().int().positive(),
        state: estadoSchema,
        created: z.literal(false),
        linkedIds: z.object({}).strict(),
        warnings: z.array(z.string()),
        requestId: z.string().guid(),
      })
      .strict()
      .parse(data);
    if (
      resultado.aggregateId !== comando.listaId ||
      resultado.requestId !== comando.requestId ||
      resultado.revision !== comando.expectedRevision + 1
    )
      throw new Error("Resposta inconsistente.");
    return resultado;
  },
  async listar(
    clienteId: string,
    ordemServicoId: string,
    limite: number,
    apos: string | null,
    signal?: AbortSignal,
  ) {
    if (
      !z.string().guid().safeParse(clienteId).success ||
      !z.string().guid().safeParse(ordemServicoId).success ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100 ||
      (apos !== null && !z.string().guid().safeParse(apos).success)
    )
      throw new Error("Parâmetros inválidos.");
    let query = supabase.schema("pcm").rpc("sso_listar_listas_materiais_mediada", {
      p_cliente_id: clienteId,
      p_ordem_servico_id: ordemServicoId,
      p_limite: limite,
      p_apos: apos,
    });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    const listas = z.array(listaSchema).parse(data);
    let anterior = apos?.toLowerCase() ?? null;
    if (listas.length > limite) throw new Error("Página inválida.");
    for (const lista of listas) {
      if (
        lista.ordem_servico_id.toLowerCase() !== ordemServicoId.toLowerCase() ||
        (anterior !== null && lista.id.toLowerCase() <= anterior)
      )
        throw new Error("Página inválida.");
      anterior = lista.id.toLowerCase();
    }
    return listas;
  },
  async criar(entrada: CriarListaMateriais) {
    const comando = validarCriarListaMateriais(entrada);
    const { data, error } = await supabase
      .schema("pcm")
      .rpc("sso_registrar_lista_materiais_mediada", {
        p_request_id: comando.requestId,
        p_expected_revision: comando.expectedRevision,
        p_lista_id: comando.listaId,
        p_ordem_servico_id: comando.ordemServicoId,
        p_responsavel: comando.responsavel,
        p_texto_original: comando.textoOriginal,
      });
    if (error) throw error;
    const resultado = resultadoSchema.parse(data);
    if (
      resultado.requestId !== comando.requestId ||
      resultado.aggregateId !== comando.listaId ||
      resultado.linkedIds.ordemServicoId !== comando.ordemServicoId
    )
      throw new Error("Resposta inconsistente.");
    return resultado;
  },
};
