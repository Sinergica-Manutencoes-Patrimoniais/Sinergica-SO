import { supabase } from "../../../lib/supabase-client";
import type {
  AgendaTecnicoGateway,
  OpcaoClienteAgenda,
  OpcaoFuncionario,
} from "../application/agenda-tecnico-gateway";
import type { AlocacaoFormData, AlocacaoTecnico } from "../domain/agenda-tecnico";

interface AgendaRow {
  id: string;
  funcionario_id: string;
  cliente_id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
}

const COLS = "id,funcionario_id,cliente_id,data,hora_inicio,hora_fim" as const;

async function mapearNomes(
  funcionarioIds: string[],
  clienteIds: string[],
): Promise<{ funcionarios: Map<string, string>; clientes: Map<string, string> }> {
  const [
    { data: funcionariosData, error: funcionariosError },
    { data: clientesData, error: clientesError },
  ] = await Promise.all([
    funcionarioIds.length > 0
      ? supabase.schema("pcm").from("funcionarios").select("id,nome").in("id", funcionarioIds)
      : Promise.resolve({ data: [], error: null }),
    clienteIds.length > 0
      ? supabase.schema("pcm").from("clientes").select("id,nome").in("id", clienteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (funcionariosError) throw funcionariosError;
  if (clientesError) throw clientesError;
  return {
    funcionarios: new Map((funcionariosData ?? []).map((f) => [f.id as string, f.nome as string])),
    clientes: new Map((clientesData ?? []).map((c) => [c.id as string, c.nome as string])),
  };
}

function mapAlocacao(
  row: AgendaRow,
  funcionarios: Map<string, string>,
  clientes: Map<string, string>,
): AlocacaoTecnico {
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    funcionarioNome: funcionarios.get(row.funcionario_id) ?? "Técnico",
    clienteId: row.cliente_id,
    clienteNome: clientes.get(row.cliente_id) ?? "Cliente",
    data: row.data,
    horaInicio: row.hora_inicio,
    horaFim: row.hora_fim,
  };
}

export const supabaseAgendaTecnicoAdapter: AgendaTecnicoGateway = {
  async listarSemana(inicioIso: string, fimIso: string): Promise<AlocacaoTecnico[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("agenda_tecnico")
      .select(COLS)
      .gte("data", inicioIso)
      .lte("data", fimIso)
      .is("deleted_at", null);
    if (error) throw error;
    const rows = (data ?? []) as AgendaRow[];
    const { funcionarios, clientes } = await mapearNomes(
      [...new Set(rows.map((r) => r.funcionario_id))],
      [...new Set(rows.map((r) => r.cliente_id))],
    );
    return rows.map((row) => mapAlocacao(row, funcionarios, clientes));
  },

  async listarFuncionarios(): Promise<OpcaoFuncionario[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .select("id,nome")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((f) => ({ id: f.id as string, nome: f.nome as string }));
  },

  async listarClientes(): Promise<OpcaoClienteAgenda[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select("id,nome")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string }));
  },

  async criar(input: AlocacaoFormData, userId: string): Promise<AlocacaoTecnico> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("agenda_tecnico")
      .insert({
        funcionario_id: input.funcionarioId,
        cliente_id: input.clienteId,
        data: input.data,
        hora_inicio: input.horaInicio ?? null,
        hora_fim: input.horaFim ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    const { funcionarios, clientes } = await mapearNomes([input.funcionarioId], [input.clienteId]);
    return mapAlocacao(data as AgendaRow, funcionarios, clientes);
  },

  async editar(id: string, input: AlocacaoFormData, userId: string): Promise<AlocacaoTecnico> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("agenda_tecnico")
      .update({
        funcionario_id: input.funcionarioId,
        cliente_id: input.clienteId,
        data: input.data,
        hora_inicio: input.horaInicio ?? null,
        hora_fim: input.horaFim ?? null,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) throw error;
    const { funcionarios, clientes } = await mapearNomes([input.funcionarioId], [input.clienteId]);
    return mapAlocacao(data as AgendaRow, funcionarios, clientes);
  },

  async remover(id: string): Promise<void> {
    const { error } = await supabase
      .schema("pcm")
      .from("agenda_tecnico")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};
