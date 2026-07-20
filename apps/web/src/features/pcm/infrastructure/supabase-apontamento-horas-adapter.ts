import { supabase } from "../../../lib/supabase-client";
import type {
  ApontamentoHorasGateway,
  ClienteOpcaoHoras,
  TecnicoOpcaoHoras,
} from "../application/apontamento-horas-gateway";
import { calcularHorasOs } from "../domain/apontamento-horas";
import type { ApontamentoHorasItem } from "../domain/apontamento-horas";

interface ApontamentoRow {
  os_id: string;
  os_numero: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  tecnico_funcionario_id: string | null;
  tecnico_nome: string | null;
  data_agendada: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  duracao_horas: number | null;
}

export const supabaseApontamentoHorasAdapter: ApontamentoHorasGateway = {
  async listarApontamentos(inicio: string, fim: string): Promise<ApontamentoHorasItem[]> {
    const { data, error } = await supabase.schema("pcm").rpc("fn_apontamento_horas", {
      p_inicio: inicio,
      p_fim: fim,
    });
    if (error) throw error;
    return ((data ?? []) as ApontamentoRow[]).map((row) => ({
      osId: row.os_id,
      osNumero: row.os_numero,
      clienteId: row.cliente_id,
      clienteNome: row.cliente_nome ?? "Sem cliente",
      tecnicoFuncionarioId: row.tecnico_funcionario_id,
      tecnicoNome: row.tecnico_nome ?? "Sem técnico",
      dataAgendada: row.data_agendada,
      checkInAt: row.check_in_at,
      checkOutAt: row.check_out_at,
      horas: calcularHorasOs(row.duracao_horas, row.check_in_at, row.check_out_at),
    }));
  },

  async listarClientes(): Promise<ClienteOpcaoHoras[]> {
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

  async listarTecnicos(): Promise<TecnicoOpcaoHoras[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .select("id,nome,jornada_diaria_horas")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((f) => ({
      id: f.id as string,
      nome: f.nome as string,
      jornadaDiariaHoras: (f.jornada_diaria_horas as number | null) ?? null,
    }));
  },

  // AC-4: `financeiro.custos_funcionario` (E04-S06) ainda não existe neste repo — schema exato
  // (nome de colunas/vigência) não confirmado, esquema abaixo é a melhor suposição a partir da
  // spec; ajustar quando E04-S06 for implementada. Até lá, sempre cai no catch e devolve null —
  // comportamento esperado e correto (tela mostra só horas com nota), não um bug.
  async buscarValorHora(tecnicoFuncionarioId: string): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .schema("financeiro")
        .from("custos_funcionario")
        .select("valor_hora")
        .eq("funcionario_id", tecnicoFuncionarioId)
        .order("vigencia_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if (["PGRST205", "42P01", "PGRST106"].includes(error.code ?? "")) return null;
        throw error;
      }
      return (data?.valor_hora as number | null) ?? null;
    } catch {
      return null;
    }
  },
};
