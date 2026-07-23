import { supabase } from "../../../lib/supabase-client";
import type {
  ChamadoOpcao,
  HistoricoChamadoGateway,
} from "../application/historico-chamado-gateway";
import type { HistoricoChamadoSnapshot, MensagemSnapshot } from "../domain/historico-chamado";

interface ChamadoRow {
  id: string;
  numero: string;
  titulo: string;
  status: string;
}

interface MensagemRow {
  id: string;
  remetente_tipo: string;
  conteudo: string | null;
  tipo_conteudo: string;
  midia_url: string | null;
  created_at: string;
}

interface SnapshotRow {
  id: string;
  conversa_id: string;
  chamado_id: string;
  janela_dias: number;
  data_inicio: string;
  data_fim: string;
  mensagens: MensagemSnapshot[];
  total_mensagens: number;
  created_at: string;
}

const CHAMADO_COLS = "id,numero,titulo,status" as const;
const SNAPSHOT_COLS =
  "id,conversa_id,chamado_id,janela_dias,data_inicio,data_fim,mensagens,total_mensagens,created_at" as const;

function mapSnapshot(row: SnapshotRow): HistoricoChamadoSnapshot {
  return {
    id: row.id,
    conversaId: row.conversa_id,
    chamadoId: row.chamado_id,
    janelaDias: row.janela_dias,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    mensagens: row.mensagens,
    totalMensagens: row.total_mensagens,
    createdAt: row.created_at,
  };
}

/** E01-S89: Atendimento é Conformist do PCM aqui — lê/escreve `pcm.chamados` direto via
 * `.schema("pcm")`, nunca importa código de `features/pcm/` (mesmo padrão já usado por
 * `supabase-atendimento-adapter.ts` pra `pcm.clientes`, e por `supabase-financeiro-adapter.ts`
 * pra `pcm.clientes`/`pcm.funcionarios`). */
export const supabaseHistoricoChamadoAdapter: HistoricoChamadoGateway = {
  async listarChamadosDoCliente(clienteId: string): Promise<ChamadoOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("chamados")
      .select(CHAMADO_COLS)
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as ChamadoRow[]).map((row) => ({
      id: row.id,
      numero: row.numero,
      titulo: row.titulo,
      status: row.status,
    }));
  },

  async criarChamadoRapido(clienteId, titulo, userId): Promise<ChamadoOpcao> {
    const { data: numero, error: numeroError } = await supabase
      .schema("pcm")
      .rpc("fn_proximo_numero_chamado");
    if (numeroError) throw numeroError;
    const { data, error } = await supabase
      .schema("pcm")
      .from("chamados")
      .insert({
        numero,
        cliente_id: clienteId,
        titulo,
        origem: "whatsapp",
        created_by: userId,
        updated_by: userId,
      })
      .select(CHAMADO_COLS)
      .single();
    if (error) throw error;
    const row = data as ChamadoRow;
    return { id: row.id, numero: row.numero, titulo: row.titulo, status: row.status };
  },

  async listarMensagensDaJanela(conversaId, dataInicio, dataFim): Promise<MensagemSnapshot[]> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("mensagens")
      .select("id,remetente_tipo,conteudo,tipo_conteudo,midia_url,created_at")
      .eq("conversa_id", conversaId)
      .gte("created_at", dataInicio)
      .lte("created_at", dataFim)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as MensagemRow[]).map((row) => ({
      id: row.id,
      remetenteTipo: row.remetente_tipo,
      conteudo: row.conteudo,
      tipoConteudo: row.tipo_conteudo,
      midiaUrl: row.midia_url,
      createdAt: row.created_at,
    }));
  },

  async salvarSnapshot(input): Promise<HistoricoChamadoSnapshot> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("historico_chamado_snapshots")
      .insert({
        conversa_id: input.conversaId,
        chamado_id: input.chamadoId,
        janela_dias: input.janelaDias,
        data_inicio: input.dataInicio,
        data_fim: input.dataFim,
        mensagens: input.mensagens,
        total_mensagens: input.mensagens.length,
        created_by: input.userId,
      })
      .select(SNAPSHOT_COLS)
      .single();
    if (error) throw error;
    return mapSnapshot(data as SnapshotRow);
  },

  async listarSnapshotsDoChamado(chamadoId): Promise<HistoricoChamadoSnapshot[]> {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("historico_chamado_snapshots")
      .select(SNAPSHOT_COLS)
      .eq("chamado_id", chamadoId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as SnapshotRow[]).map(mapSnapshot);
  },
};
