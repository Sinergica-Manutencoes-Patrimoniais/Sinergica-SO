import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type {
  ConsultaDestinosGateway,
  ConsultaGruposGateway,
  ConsultaHistoricoGateway,
  EstruturaTecnicaGateway,
  MovimentarComponenteGateway,
} from "../application/estrutura-tecnica-gateway";

const resultadoSchema = z
  .object({
    aggregateId: z.string().uuid(),
    revision: z.number().int().positive(),
    state: z.boolean(),
    created: z.boolean(),
    linkedIds: z.record(z.string()),
    warnings: z.array(z.string()),
    requestId: z.string().uuid(),
  })
  .strict();

const grupoSchema = z
  .object({
    id: z.string().uuid(),
    cliente_id: z.string().uuid(),
    local_id: z.string().uuid(),
    categoria_id: z.string().uuid(),
    sistema_id: z.string().uuid().nullable(),
    nome: z.string(),
    quantidade: z.number().int().positive().safe(),
    caracteristicas: z.record(z.string()),
    revisao: z.number().int().positive(),
  })
  .transform((g) => ({
    id: g.id,
    clienteId: g.cliente_id,
    localId: g.local_id,
    categoriaId: g.categoria_id,
    sistemaId: g.sistema_id,
    nome: g.nome,
    quantidade: g.quantidade,
    caracteristicas: g.caracteristicas,
    revisao: g.revisao,
  }));

const historicoSchema = z
  .object({
    evento_id: z.string().uuid(),
    ocorrido_em: z.string(),
    acao: z.string(),
    ator_id: z.string().uuid().nullable(),
    antes: z.record(z.unknown()).nullable(),
    depois: z.record(z.unknown()),
  })
  .transform((e) => ({
    id: e.evento_id,
    data: e.ocorrido_em,
    acao: e.acao,
    atorId: e.ator_id,
    antes: e.antes,
    depois: e.depois,
  }));

export const supabaseEstruturaTecnicaAdapter: EstruturaTecnicaGateway &
  ConsultaGruposGateway &
  ConsultaHistoricoGateway &
  MovimentarComponenteGateway &
  ConsultaDestinosGateway = {
  async listarDestinos(clienteId, tipo, limite, apos, busca, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_destinos_estrutura", {
      p_cliente_id: clienteId,
      p_tipo: tipo,
      p_limite: limite,
      p_apos: apos,
      p_busca: busca,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z
      .array(
        z
          .object({
            id: z.string().uuid(),
            nome: z.string(),
            area_id: z.string().uuid().nullable(),
          })
          .transform((d) => ({ id: d.id, nome: d.nome, areaId: d.area_id })),
      )
      .parse(data);
  },
  async moverComponente(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_mover_componente", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_id: c.componenteId,
      p_area_id: c.areaId,
      p_local_id: c.localId,
      p_parent_id: c.parentId,
    });
    if (error) throw error;
    return resultadoSchema.parse(data);
  },
  async salvarGrupo(c) {
    const { data, error } = await supabase.schema("pcm").rpc("sso_salvar_grupo_quantitativo", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_grupo_id: c.grupoId,
      p_local_id: c.localId,
      p_categoria_id: c.categoriaId,
      p_sistema_id: c.sistemaId,
      p_nome: c.nome,
      p_quantidade: c.quantidade,
      p_caracteristicas: c.caracteristicas,
    });
    if (error) throw error;
    return resultadoSchema.parse(data);
  },
  async listarGrupos(clienteId, inicio, limite, signal) {
    if (
      !Number.isSafeInteger(inicio) ||
      inicio < 0 ||
      !Number.isSafeInteger(limite) ||
      limite < 1 ||
      limite > 100
    ) {
      throw new Error("Paginação inválida.");
    }
    let consulta = supabase
      .schema("pcm")
      .from("grupos_quantitativos")
      .select(
        "id,cliente_id,local_id,categoria_id,sistema_id,nome,quantidade,caracteristicas,revisao",
      )
      .eq("cliente_id", clienteId)
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(inicio, inicio + limite - 1);
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(grupoSchema).parse(data);
  },
  async listarHistorico(tipo, id, limite, cursor, signal) {
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100)
      throw new Error("Paginação inválida.");
    let consulta = supabase.schema("pcm").rpc("sso_listar_historico_estrutura", {
      p_tipo: tipo,
      p_id: id,
      p_limite: limite,
      p_antes: cursor?.data ?? null,
      p_antes_id: cursor?.id ?? null,
    });
    if (signal) consulta = consulta.abortSignal(signal);
    const { data, error } = await consulta;
    if (error) throw error;
    return z.array(historicoSchema).parse(data);
  },
};
