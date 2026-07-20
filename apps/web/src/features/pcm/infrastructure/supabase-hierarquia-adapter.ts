import { supabase } from "../../../lib/supabase-client";
import type {
  AreaCommand,
  EditarAreaCommand,
  EditarLocalCommand,
  HierarquiaGateway,
  LocalCommand,
  LocalTipoCommand,
} from "../application/hierarquia-gateway";
import type { Area, Local, LocalTipo } from "../domain/hierarquia";

interface AreaRow {
  id: string;
  cliente_id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

interface LocalRow {
  id: string;
  area_id: string;
  parent_id: string | null;
  nome: string;
  tipo_id: string | null;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

interface LocalTipoRow {
  id: string;
  cliente_id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

const AREA_COLS = "id,cliente_id,nome,descricao,ordem,ativo" as const;
const LOCAL_COLS = "id,area_id,parent_id,nome,tipo_id,descricao,ordem,ativo" as const;
const LOCAL_TIPO_COLS = "id,cliente_id,nome,ordem,ativo" as const;

function mapArea(row: AreaRow): Area {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    nome: row.nome,
    descricao: row.descricao,
    ordem: row.ordem,
    ativo: row.ativo,
  };
}

function mapLocalTipo(row: LocalTipoRow): LocalTipo {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    nome: row.nome,
    ordem: row.ordem,
    ativo: row.ativo,
  };
}

function mapLocal(row: LocalRow, tipos: Map<string, string>): Local {
  return {
    id: row.id,
    areaId: row.area_id,
    parentId: row.parent_id,
    nome: row.nome,
    tipoId: row.tipo_id,
    tipoNome: row.tipo_id ? (tipos.get(row.tipo_id) ?? null) : null,
    descricao: row.descricao,
    ordem: row.ordem,
    ativo: row.ativo,
  };
}

/** Resolve o cliente_id dono de uma Área — Local não guarda cliente_id direto (só via Área). */
async function clienteIdDaArea(areaId: string): Promise<string | null> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("areas")
    .select("cliente_id")
    .eq("id", areaId)
    .maybeSingle();
  if (error) throw error;
  return (data?.cliente_id as string | undefined) ?? null;
}

async function mapaTiposDoCliente(clienteId: string | null): Promise<Map<string, string>> {
  if (!clienteId) return new Map();
  const { data, error } = await supabase
    .schema("pcm")
    .from("local_tipos")
    .select("id,nome")
    .eq("cliente_id", clienteId)
    .is("deleted_at", null);
  if (error) throw error;
  return new Map((data ?? []).map((t) => [t.id as string, t.nome as string]));
}

export const supabaseHierarquiaAdapter: HierarquiaGateway = {
  async listarAreas(clienteId) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("areas")
      .select(AREA_COLS)
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as AreaRow[]).map(mapArea);
  },

  async criarArea(input: AreaCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("areas")
      .insert({
        cliente_id: input.clienteId,
        nome: input.nome,
        descricao: input.descricao,
        ordem: input.ordem ?? 0,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(AREA_COLS)
      .single();
    if (error) throw error;
    return mapArea(data as AreaRow);
  },

  async editarArea(input: EditarAreaCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("areas")
      .update({
        nome: input.nome,
        descricao: input.descricao,
        ordem: input.ordem ?? 0,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(AREA_COLS)
      .single();
    if (error) throw error;
    return mapArea(data as AreaRow);
  },

  async desativarArea(id, userId) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("areas")
      .update({ ativo: false, deleted_at: agora, updated_at: agora, updated_by: userId })
      .eq("id", id);
    if (error) throw error;
  },

  async listarLocais(areaId) {
    const [{ data, error }, tipos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("locais")
        .select(LOCAL_COLS)
        .eq("area_id", areaId)
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true }),
      clienteIdDaArea(areaId).then(mapaTiposDoCliente),
    ]);
    if (error) throw error;
    return ((data ?? []) as LocalRow[]).map((row) => mapLocal(row, tipos));
  },

  async listarLocaisDoCliente(clienteId) {
    const areas = await supabase
      .schema("pcm")
      .from("areas")
      .select("id")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null);
    if (areas.error) throw areas.error;
    const areaIds = (areas.data ?? []).map((a) => a.id as string);
    if (areaIds.length === 0) return [];
    const [{ data, error }, tipos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("locais")
        .select(LOCAL_COLS)
        .in("area_id", areaIds)
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true }),
      mapaTiposDoCliente(clienteId),
    ]);
    if (error) throw error;
    return ((data ?? []) as LocalRow[]).map((row) => mapLocal(row, tipos));
  },

  async criarLocal(input: LocalCommand) {
    const [{ data, error }, tipos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("locais")
        .insert({
          area_id: input.areaId,
          parent_id: input.parentId ?? null,
          nome: input.nome,
          tipo_id: input.tipoId ?? null,
          descricao: input.descricao,
          ordem: input.ordem ?? 0,
          created_by: input.userId,
          updated_by: input.userId,
        })
        .select(LOCAL_COLS)
        .single(),
      clienteIdDaArea(input.areaId).then(mapaTiposDoCliente),
    ]);
    if (error) throw error;
    return mapLocal(data as LocalRow, tipos);
  },

  async editarLocal(input: EditarLocalCommand) {
    const [{ data, error }, tipos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("locais")
        .update({
          area_id: input.areaId,
          parent_id: input.parentId ?? null,
          nome: input.nome,
          tipo_id: input.tipoId ?? null,
          descricao: input.descricao,
          ordem: input.ordem ?? 0,
          updated_at: new Date().toISOString(),
          updated_by: input.userId,
        })
        .eq("id", input.id)
        .select(LOCAL_COLS)
        .single(),
      clienteIdDaArea(input.areaId).then(mapaTiposDoCliente),
    ]);
    if (error) throw error;
    return mapLocal(data as LocalRow, tipos);
  },

  async moverLocal(id, parentId, userId) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("locais")
      .update({ parent_id: parentId, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id)
      .select(LOCAL_COLS)
      .single();
    if (error) throw error;
    const row = data as LocalRow;
    const tipos = await clienteIdDaArea(row.area_id).then(mapaTiposDoCliente);
    return mapLocal(row, tipos);
  },

  async desativarLocal(id, userId) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("locais")
      .update({ ativo: false, deleted_at: agora, updated_at: agora, updated_by: userId })
      .eq("id", id);
    if (error) throw error;
  },

  async possuiItensInstalados(localId) {
    const { count, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("id", { count: "exact", head: true })
      .eq("local_id", localId)
      .is("deleted_at", null);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async listarTiposDeLocal(clienteId) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("local_tipos")
      .select(LOCAL_TIPO_COLS)
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as LocalTipoRow[]).map(mapLocalTipo);
  },

  async criarTipoDeLocal(input: LocalTipoCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("local_tipos")
      .insert({
        cliente_id: input.clienteId,
        nome: input.nome,
        ordem: input.ordem ?? 0,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(LOCAL_TIPO_COLS)
      .single();
    if (error) throw error;
    return mapLocalTipo(data as LocalTipoRow);
  },

  async desativarTipoDeLocal(id, userId) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("local_tipos")
      .update({ ativo: false, deleted_at: agora, updated_at: agora, updated_by: userId })
      .eq("id", id);
    if (error) throw error;
  },
};
