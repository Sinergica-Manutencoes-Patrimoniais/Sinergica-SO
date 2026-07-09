import { supabase } from "../../../lib/supabase-client";
import type { AlterarStatusOsInput, HubOsGateway } from "../application/hub-os-gateway";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";

interface ClienteRow {
  id: string;
  nome: string;
}

interface FuncionarioRow {
  id: string;
  nome: string;
}

interface OrdemRow {
  id: string;
  client_id: string;
  numero: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  status: string;
  prioridade: string;
  gravidade: number | null;
  urgencia: number | null;
  tendencia: number | null;
  score_pcm: number;
  local_descricao: string | null;
  solicitante: string | null;
  origem: string;
  auvo_task_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  created_at: string;
  updated_at: string | null;
  tecnico_funcionario_id: string | null;
  data_agendada: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  auvo_detalhes: Record<string, unknown> | null;
}

const COLUNAS_OS =
  "id,client_id,numero,titulo,descricao,categoria,status,prioridade,gravidade,urgencia,tendencia,score_pcm,local_descricao,solicitante,origem,auvo_task_id,auvo_sync_status,auvo_sync_error,created_at,updated_at,tecnico_funcionario_id,data_agendada,check_in_at,check_out_at,auvo_detalhes" as const;

function mapearOrdem(
  row: OrdemRow,
  clientes: Map<string, string>,
  funcionarios: Map<string, string>,
): OrdemServicoOperacional {
  return {
    id: row.id,
    numero: row.numero,
    titulo: row.titulo,
    clienteNome: clientes.get(row.client_id) ?? "Cliente não identificado",
    categoria: row.categoria,
    status: row.status,
    prioridade: row.prioridade,
    scorePcm: row.score_pcm,
    gravidade: row.gravidade,
    urgencia: row.urgencia,
    tendencia: row.tendencia,
    auvoTaskId: row.auvo_task_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    createdAt: row.created_at,
    tecnicoFuncionarioId: row.tecnico_funcionario_id,
    tecnicoNome: row.tecnico_funcionario_id
      ? (funcionarios.get(row.tecnico_funcionario_id) ?? null)
      : null,
    dataAgendada: row.data_agendada,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    detalhes: row.auvo_detalhes,
  };
}

/** PostgREST tem um teto de linhas por requisição (`db-max-rows`, tipicamente 1000) —
 * `.limit(200)` sozinho já cortava a lista bem antes disso. Pagina via `.range()` até esgotar ou
 * até `LIMITE_PAGINAS` (segurança), reunindo tudo. Achado testando em produção (2026-07-09): com
 * ~2364 OS reais pós-backfill, `limit(200)` fazia os KPIs (Total/Abertas/Execução) mentirem —
 * eram calculados em cima só das 200 mais recentes, não do total real. Correção provisória: busca
 * tudo. Agregação de verdade 100% server-side (count por status) fica pro redesign do Kanban, que
 * já vai mudar como esta tela carrega dado. */
const TAMANHO_PAGINA = 1000;
const LIMITE_PAGINAS = 10;

async function buscarTodasOrdens(): Promise<OrdemRow[]> {
  const todas: OrdemRow[] = [];
  for (let pagina = 0; pagina < LIMITE_PAGINAS; pagina++) {
    const inicio = pagina * TAMANHO_PAGINA;
    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .select(COLUNAS_OS)
      .is("deleted_at", null)
      // Desempate por `id` obrigatório: os inserts em lote do backfill (2026-07-09) gravam
      // centenas de linhas com o MESMO `created_at` (uma única transação, `now()` é fixo por
      // statement) — paginar por `.range()` só em `created_at` é instável entre requisições
      // quando há empate (a mesma linha pode cair em duas páginas, causando id duplicado na
      // lista/keys React duplicadas). `id` é único, garante ordem determinística.
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw error;
    const lote = (data ?? []) as OrdemRow[];
    todas.push(...lote);
    if (lote.length < TAMANHO_PAGINA) break;
  }
  return todas;
}

async function clientesPorId(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("clientes")
    .select("id,nome")
    .is("deleted_at", null);
  if (error) throw error;
  return new Map(((data ?? []) as ClienteRow[]).map((cliente) => [cliente.id, cliente.nome]));
}

async function funcionariosPorId(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("funcionarios")
    .select("id,nome")
    .is("deleted_at", null);
  if (error) throw error;
  return new Map(
    ((data ?? []) as FuncionarioRow[]).map((funcionario) => [funcionario.id, funcionario.nome]),
  );
}

async function buscarOrdem(id: string): Promise<OrdemRow> {
  const { data, error } = await supabase
    .schema("pcm")
    .from("ordens_servico")
    .select(COLUNAS_OS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as OrdemRow;
}

export const supabaseHubOsAdapter: HubOsGateway = {
  async listarOrdensServico(): Promise<OrdemServicoOperacional[]> {
    const [clientes, funcionarios, ordens] = await Promise.all([
      clientesPorId(),
      funcionariosPorId(),
      buscarTodasOrdens(),
    ]);
    return ordens.map((row) => mapearOrdem(row, clientes, funcionarios));
  },

  async alterarStatus(input: AlterarStatusOsInput): Promise<OrdemServicoOperacional> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .update({
        status: input.status,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy,
      })
      .eq("id", input.id)
      .is("deleted_at", null)
      .select(COLUNAS_OS)
      .single();

    if (error) throw error;
    const [clientes, funcionarios] = await Promise.all([clientesPorId(), funcionariosPorId()]);
    return mapearOrdem((data ?? (await buscarOrdem(input.id))) as OrdemRow, clientes, funcionarios);
  },
};
