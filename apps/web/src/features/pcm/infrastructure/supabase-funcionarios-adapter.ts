import { supabase } from "../../../lib/supabase-client";
import type {
  CriarFuncionarioCommand,
  DesativarFuncionarioCommand,
  EditarFuncionarioCommand,
  FuncionariosGateway,
} from "../application/funcionarios-gateway";
import type { FuncionarioItem } from "../domain/funcionarios";

interface FuncionarioRow {
  id: string;
  nome: string;
  equipe: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  culture: string;
  user_type: 1 | 2 | 3;
  ativo: boolean;
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
}

const COLS =
  "id,nome,equipe,cargo,telefone,email,culture,user_type,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at" as const;

function mapRow(row: FuncionarioRow): FuncionarioItem {
  return {
    id: row.id,
    nome: row.nome,
    equipe: row.equipe,
    cargo: row.cargo,
    telefone: row.telefone,
    email: row.email,
    culture: row.culture,
    userType: row.user_type,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
  };
}

export const supabaseFuncionariosAdapter: FuncionariosGateway = {
  async listar() {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .select(COLS)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as FuncionarioRow[]).map(mapRow);
  },

  async criar(input: CriarFuncionarioCommand) {
    const { data, error } = await supabase.functions.invoke("pcm-auvo-users-create", {
      body: {
        nome: input.nome,
        login: input.login,
        password: input.password,
        culture: input.culture,
        userType: input.userType,
        equipe: input.equipe,
        cargo: input.cargo,
        telefone: input.telefone,
        email: input.email,
      },
    });
    if (error) throw error;
    const id = (data as { id?: string } | null)?.id;
    if (!id) throw new Error("Funcionário criado sem id local.");
    const funcionario = await buscarPorId(id);
    if (!funcionario) throw new Error("Funcionário criado não encontrado.");
    return funcionario;
  },

  async editar(input: EditarFuncionarioCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .update({
        nome: input.nome,
        equipe: input.equipe,
        cargo: input.cargo,
        telefone: input.telefone,
        email: input.email,
        culture: input.culture,
        user_type: input.userType,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(COLS)
      .single();
    if (error) throw error;
    return mapRow(data as FuncionarioRow);
  },

  async desativar(input: DesativarFuncionarioCommand) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("funcionarios")
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

async function buscarPorId(id: string): Promise<FuncionarioItem | null> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("funcionarios")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as FuncionarioRow) : null;
}
