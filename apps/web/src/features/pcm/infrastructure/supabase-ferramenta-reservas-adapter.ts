import { supabase } from "../../../lib/supabase-client";
import type {
  CancelarReservaCommand,
  CriarReservaCommand,
  FerramentaReservasGateway,
} from "../application/ferramenta-reservas-gateway";
import type { FerramentaReservaItem, StatusReservaFerramenta } from "../domain/ferramenta-reservas";

interface ReservaRow {
  id: string;
  ferramenta_id: string;
  unidade_id: string | null;
  funcionario_id: string;
  data_inicio: string;
  data_fim: string;
  status: StatusReservaFerramenta;
  motivo_cancelamento: string | null;
}

const RESERVA_COLS =
  "id,ferramenta_id,unidade_id,funcionario_id,data_inicio,data_fim,status,motivo_cancelamento" as const;

async function mapasDeApoio(): Promise<{
  ferramentas: Map<string, string>;
  funcionarios: Map<string, string>;
  unidades: Map<string, string>;
}> {
  const [ferramentas, funcionarios, unidades] = await Promise.all([
    supabase.schema("pcm").from("ferramentas").select("id,nome").is("deleted_at", null),
    supabase.schema("pcm").from("funcionarios").select("id,nome").is("deleted_at", null),
    supabase.schema("pcm").from("ferramenta_unidades").select("id,codigo"),
  ]);
  if (ferramentas.error) throw ferramentas.error;
  if (funcionarios.error) throw funcionarios.error;
  if (unidades.error) throw unidades.error;
  return {
    ferramentas: new Map((ferramentas.data ?? []).map((f) => [f.id as string, f.nome as string])),
    funcionarios: new Map((funcionarios.data ?? []).map((f) => [f.id as string, f.nome as string])),
    unidades: new Map((unidades.data ?? []).map((u) => [u.id as string, u.codigo as string])),
  };
}

function mapReserva(
  row: ReservaRow,
  apoio: Awaited<ReturnType<typeof mapasDeApoio>>,
): FerramentaReservaItem {
  return {
    id: row.id,
    ferramentaId: row.ferramenta_id,
    ferramentaNome: apoio.ferramentas.get(row.ferramenta_id) ?? "Ferramenta removida",
    unidadeId: row.unidade_id,
    unidadeCodigo: row.unidade_id ? (apoio.unidades.get(row.unidade_id) ?? null) : null,
    funcionarioId: row.funcionario_id,
    funcionarioNome: apoio.funcionarios.get(row.funcionario_id) ?? "Técnico removido",
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    status: row.status,
    motivoCancelamento: row.motivo_cancelamento,
  };
}

export const supabaseFerramentaReservasAdapter: FerramentaReservasGateway = {
  async listarReservas() {
    const [reservas, apoio] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ferramenta_reservas")
        .select(RESERVA_COLS)
        .order("data_inicio", { ascending: true }),
      mapasDeApoio(),
    ]);
    if (reservas.error) throw reservas.error;
    return ((reservas.data ?? []) as ReservaRow[]).map((row) => mapReserva(row, apoio));
  },

  async criar(input: CriarReservaCommand) {
    const { data, error } = await supabase
      .schema("pcm")
      .from("ferramenta_reservas")
      .insert({
        ferramenta_id: input.ferramentaId,
        unidade_id: input.unidadeId ?? null,
        funcionario_id: input.funcionarioId,
        data_inicio: input.dataInicio,
        data_fim: input.dataFim ?? input.dataInicio,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(RESERVA_COLS)
      .single();
    if (error) throw error;
    const apoio = await mapasDeApoio();
    return mapReserva(data as ReservaRow, apoio);
  },

  async marcarEfetivada(reservaId: string, unidadeId: string, userId: string) {
    const { error } = await supabase
      .schema("pcm")
      .from("ferramenta_reservas")
      .update({
        status: "efetivada",
        unidade_id: unidadeId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", reservaId);
    if (error) throw error;
  },

  async cancelar(input: CancelarReservaCommand) {
    const { error } = await supabase
      .schema("pcm")
      .from("ferramenta_reservas")
      .update({
        status: "cancelada",
        motivo_cancelamento: input.motivo ?? null,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.reservaId);
    if (error) throw error;
  },
};
