import { supabase } from "../../../lib/supabase-client";
import type {
  ChamadosGateway,
  CriarChamadoCommand,
  FiltrosChamados,
} from "../application/chamados-gateway";
import type {
  Chamado,
  HistoricoAtendimentoChamado,
  MensagemHistoricoAtendimento,
  OrigemChamado,
  StatusChamado,
} from "../domain/chamados";

const BUCKET_ANEXOS = "chamados-anexos";

interface ChamadoRow {
  id: string;
  numero: string;
  cliente_id: string;
  titulo: string;
  descricao: string | null;
  origem: OrigemChamado;
  status: StatusChamado;
  solicitante: string | null;
  ordem_servico_id: string | null;
  cancelamento_justificativa: string | null;
  cancelamento_anexo_path: string | null;
  created_at: string;
}

const CHAMADO_COLS =
  "id,numero,cliente_id,titulo,descricao,origem,status,solicitante,ordem_servico_id,cancelamento_justificativa,cancelamento_anexo_path,created_at" as const;

function mapChamado(row: ChamadoRow): Chamado {
  return {
    id: row.id,
    numero: row.numero,
    clienteId: row.cliente_id,
    titulo: row.titulo,
    descricao: row.descricao,
    origem: row.origem,
    status: row.status,
    solicitante: row.solicitante,
    ordemServicoId: row.ordem_servico_id,
    cancelamentoJustificativa: row.cancelamento_justificativa,
    cancelamentoAnexoPath: row.cancelamento_anexo_path,
    createdAt: row.created_at,
  };
}

interface SnapshotRow {
  id: string;
  janela_dias: number;
  data_inicio: string;
  data_fim: string;
  mensagens: MensagemHistoricoAtendimento[];
  total_mensagens: number;
  created_at: string;
}

function mapSnapshot(row: SnapshotRow): HistoricoAtendimentoChamado {
  return {
    id: row.id,
    janelaDias: row.janela_dias,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    mensagens: row.mensagens,
    totalMensagens: row.total_mensagens,
    createdAt: row.created_at,
  };
}

async function proximoNumeroChamado(): Promise<string> {
  const { data, error } = await supabase.schema("pcm").rpc("fn_proximo_numero_chamado");
  if (error) throw error;
  return data as string;
}

async function registrarEvento(
  chamadoId: string,
  tipo: "criado" | "os_gerada" | "enviado_backlog" | "cancelado",
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .schema("pcm")
    .from("chamados_eventos")
    .insert({ chamado_id: chamadoId, tipo, metadata });
  if (error) throw error;
}

export const supabaseChamadosAdapter: ChamadosGateway = {
  async listar(filtros?: FiltrosChamados): Promise<Chamado[]> {
    let query = supabase.schema("pcm").from("chamados").select(CHAMADO_COLS).is("deleted_at", null);
    if (filtros?.clienteId) query = query.eq("cliente_id", filtros.clienteId);
    if (filtros?.status) query = query.eq("status", filtros.status);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as ChamadoRow[]).map(mapChamado);
  },

  async obter(id: string): Promise<Chamado | null> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("chamados")
      .select(CHAMADO_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapChamado(data as ChamadoRow) : null;
  },

  async criar(input: CriarChamadoCommand): Promise<Chamado> {
    const numero = await proximoNumeroChamado();
    const { data, error } = await supabase
      .schema("pcm")
      .from("chamados")
      .insert({
        numero,
        cliente_id: input.clienteId,
        titulo: input.titulo,
        descricao: input.descricao,
        origem: input.origem ?? "manual",
        solicitante: input.solicitante,
        origem_inspecao_item_id: input.origemInspecaoItemId ?? null,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(CHAMADO_COLS)
      .single();
    if (error) throw error;
    const chamado = mapChamado(data as ChamadoRow);
    await registrarEvento(chamado.id, "criado", { numero: chamado.numero });
    return chamado;
  },

  async marcarStatusComOs(chamadoId, status, ordemServicoId, userId): Promise<void> {
    const { error } = await supabase
      .schema("pcm")
      .from("chamados")
      .update({
        status,
        ordem_servico_id: ordemServicoId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", chamadoId);
    if (error) throw error;
    await registrarEvento(chamadoId, status === "convertido_os" ? "os_gerada" : "enviado_backlog", {
      ordemServicoId,
    });
  },

  async cancelar(chamadoId, justificativa, anexoPath, userId): Promise<void> {
    const { error } = await supabase
      .schema("pcm")
      .from("chamados")
      .update({
        status: "cancelado",
        cancelamento_justificativa: justificativa,
        cancelamento_anexo_path: anexoPath,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", chamadoId);
    if (error) throw error;
    await registrarEvento(chamadoId, "cancelado", { justificativa, temAnexo: anexoPath != null });
  },

  async uploadAnexoCancelamento(chamadoId: string, arquivo: File): Promise<string> {
    const extensao = arquivo.name.split(".").pop() ?? "bin";
    const path = `${chamadoId}/${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage
      .from(BUCKET_ANEXOS)
      .upload(path, arquivo, { contentType: arquivo.type || undefined });
    if (error) throw error;
    return path;
  },

  async listarHistoricoAtendimento(chamadoId: string): Promise<HistoricoAtendimentoChamado[]> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("historico_chamado_snapshots")
      .select("id,janela_dias,data_inicio,data_fim,mensagens,total_mensagens,created_at")
      .eq("chamado_id", chamadoId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as SnapshotRow[]).map(mapSnapshot);
  },
};
