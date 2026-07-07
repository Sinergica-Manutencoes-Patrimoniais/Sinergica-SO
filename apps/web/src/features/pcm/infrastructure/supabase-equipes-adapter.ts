import { supabase } from "../../../lib/supabase-client";
import type {
  DesativarEquipeCommand,
  EditarEquipeCommand,
  EquipeCommand,
  EquipesGateway,
} from "../application/equipes-gateway";
import type { EquipeFuncionarioOpcao, EquipeItem } from "../domain/equipes";

interface EquipeRow {
  id: string;
  nome: string;
  participantes_auvo_ids: number[];
  gestores_auvo_ids: number[];
  ativo: boolean;
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
}

interface FuncionarioRow {
  id: string;
  nome: string;
  auvo_user_id: number | null;
}

const COLS =
  "id,nome,participantes_auvo_ids,gestores_auvo_ids,ativo,auvo_id,auvo_sync_status,auvo_sync_error" as const;

function mapRow(row: EquipeRow, funcionarios: Map<number, string>): EquipeItem {
  return {
    id: row.id,
    nome: row.nome,
    participantesAuvoIds: row.participantes_auvo_ids ?? [],
    gestoresAuvoIds: row.gestores_auvo_ids ?? [],
    participantesNomes: (row.participantes_auvo_ids ?? []).map(
      (id) => funcionarios.get(id) ?? `Auvo ${id}`,
    ),
    gestoresNomes: (row.gestores_auvo_ids ?? []).map((id) => funcionarios.get(id) ?? `Auvo ${id}`),
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
  };
}

export const supabaseEquipesAdapter: EquipesGateway = {
  async listar() {
    const [equipes, funcionarios] = await Promise.all([
      supabase
        .schema("pcm")
        .from("equipes")
        .select(COLS)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      this.listarFuncionarios(),
    ]);
    if (equipes.error) throw equipes.error;
    const funcionariosMap = new Map(
      funcionarios
        .filter((item) => item.auvoUserId != null)
        .map((item) => [item.auvoUserId as number, item.nome]),
    );
    return ((equipes.data ?? []) as EquipeRow[]).map((row) => mapRow(row, funcionariosMap));
  },

  async listarFuncionarios(): Promise<EquipeFuncionarioOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .select("id,nome,auvo_user_id")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as FuncionarioRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      auvoUserId: row.auvo_user_id,
    }));
  },

  async criar(input: EquipeCommand) {
    const funcionarios = await this.listarFuncionarios();
    const ids = resolverIds(input, funcionarios);
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipes")
      .insert({
        nome: input.nome,
        participantes_auvo_ids: ids.participantes,
        gestores_auvo_ids: ids.gestores,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    return mapRow(data as EquipeRow, mapFuncionarios(funcionarios));
  },

  async editar(input: EditarEquipeCommand) {
    const funcionarios = await this.listarFuncionarios();
    const ids = resolverIds(input, funcionarios);
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipes")
      .update({
        nome: input.nome,
        participantes_auvo_ids: ids.participantes,
        gestores_auvo_ids: ids.gestores,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(COLS)
      .single();
    if (error) throw error;
    return mapRow(data as EquipeRow, mapFuncionarios(funcionarios));
  },

  async desativar(input: DesativarEquipeCommand) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("equipes")
      .update({
        ativo: false,
        deleted_at: agora,
        auvo_sync_status: "pending",
        updated_at: agora,
        updated_by: input.userId,
      })
      .eq("id", input.id);
    if (error) throw error;
  },
};

function resolverIds(
  input: Pick<EquipeCommand, "participanteIds" | "gestorIds">,
  funcionarios: EquipeFuncionarioOpcao[],
) {
  const porId = new Map(funcionarios.map((item) => [item.id, item.auvoUserId]));
  return {
    participantes: input.participanteIds
      .map((id) => porId.get(id))
      .filter((id): id is number => id != null),
    gestores: input.gestorIds.map((id) => porId.get(id)).filter((id): id is number => id != null),
  };
}

function mapFuncionarios(funcionarios: EquipeFuncionarioOpcao[]): Map<number, string> {
  return new Map(
    funcionarios
      .filter((item) => item.auvoUserId != null)
      .map((item) => [item.auvoUserId as number, item.nome]),
  );
}
