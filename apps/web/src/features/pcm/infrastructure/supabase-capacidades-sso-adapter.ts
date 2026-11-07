import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import type { CapacidadesSsoGateway } from "../application/capacidades-sso-gateway";
import { ACOES_SSO } from "../domain/capacidades-sso";

const resultadoSchema = z
  .object({
    aggregateId: z.string().guid(),
    revision: z.number().int().nonnegative(),
    state: z.boolean(),
    created: z.boolean(),
    linkedIds: z.record(z.string(), z.string()),
    warnings: z.array(z.string()),
    requestId: z.string().guid(),
  })
  .strict();

const perfilSchema = z.object({
  id: z.string().guid(),
  nome: z.string(),
  ativo: z.boolean(),
  revisao: z.number().int().nonnegative(),
});
const vinculoSchema = z
  .object({
    id: z.string().guid(),
    usuario_id: z.string().guid(),
    perfil_id: z.string().guid(),
    ativo: z.boolean(),
    revisao: z.number().int().nonnegative(),
  })
  .transform((x) => ({
    id: x.id,
    usuarioId: x.usuario_id,
    perfilId: x.perfil_id,
    ativo: x.ativo,
    revisao: x.revisao,
  }));
const concessaoSchema = z
  .object({
    id: z.string().guid(),
    usuario_id: z.string().guid().nullable(),
    perfil_id: z.string().guid().nullable(),
    acao: z.enum(ACOES_SSO),
    cliente_id: z.string().guid().nullable(),
    ativa: z.boolean(),
    revisao: z.number().int().nonnegative(),
  })
  .transform((x) => ({
    id: x.id,
    usuarioId: x.usuario_id,
    perfilId: x.perfil_id,
    acao: x.acao,
    clienteId: x.cliente_id,
    ativa: x.ativa,
    revisao: x.revisao,
  }));
const usuarioSchema = z
  .object({ user_id: z.string().guid(), nome: z.string(), papel: z.string(), ativo: z.boolean() })
  .transform((x) => ({ userId: x.user_id, nome: x.nome, papel: x.papel, ativo: x.ativo }));
const clienteSchema = z.object({ id: z.string().guid(), nome: z.string() });

async function listar<T>(
  rpc: string,
  pagina: { inicio: number; limite: number },
  schema: z.ZodType<T, unknown>,
): Promise<T[]> {
  const { data, error } = await supabase
    .schema("config")
    .rpc(rpc, { p_inicio: pagina.inicio, p_limite: pagina.limite });
  if (error) throw error;
  return z.array(schema).parse(data);
}

export const supabaseCapacidadesSsoAdapter: CapacidadesSsoGateway = {
  async definirConcessao(c) {
    const { data, error } = await supabase.schema("config").rpc("sso_definir_concessao", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_usuario_id: c.usuarioId,
      p_perfil_id: c.perfilId,
      p_acao: c.acao,
      p_cliente_id: c.clienteId,
      p_ativa: c.ativa,
      p_motivo: c.motivo,
    });
    if (error) throw error;
    return resultadoSchema.parse(data);
  },
  async definirPerfil(c) {
    const { data, error } = await supabase.schema("config").rpc("sso_definir_perfil", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_perfil_id: c.perfilId,
      p_nome: c.nome,
      p_ativo: c.ativo,
      p_motivo: c.motivo,
    });
    if (error) throw error;
    return resultadoSchema.parse(data);
  },
  async definirVinculoPerfil(c) {
    const { data, error } = await supabase.schema("config").rpc("sso_definir_vinculo_perfil", {
      p_request_id: c.requestId,
      p_expected_revision: c.expectedRevision,
      p_usuario_id: c.usuarioId,
      p_perfil_id: c.perfilId,
      p_ativo: c.ativo,
      p_motivo: c.motivo,
    });
    if (error) throw error;
    return resultadoSchema.parse(data);
  },
  async autorizarAcao(acao, clienteId) {
    const { data, error } = await supabase
      .schema("config")
      .rpc("sso_autorizar_acao", { p_acao: acao, p_cliente_id: clienteId });
    if (error) throw error;
    return z.boolean().parse(data);
  },
  listarPerfis: (pagina) => listar("sso_listar_perfis", pagina, perfilSchema),
  listarVinculos: (pagina) => listar("sso_listar_vinculos", pagina, vinculoSchema),
  listarConcessoes: (pagina) => listar("sso_listar_concessoes", pagina, concessaoSchema),
  listarUsuarios: (pagina) => listar("sso_listar_usuarios", pagina, usuarioSchema),
  listarClientes: (pagina) => listar("sso_listar_clientes", pagina, clienteSchema),
};
