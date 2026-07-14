// Porta (interface) que a infrastructure implementa. A application só conhece este contrato —
// nunca importa @supabase/supabase-js diretamente (ver docs/ARCHITECTURE.md — application/).
// Read-model DTOs da Visão 360 (E01-S12): já em camelCase, desacoplados do snake_case do banco.

/** Cabeçalho de cadastro do cliente (AC-2). */
export interface ClienteHeader {
  id: string;
  nome: string;
  cnpj: string | null;
  auvoId: number | null;
  ativo: boolean;
  tipo?: "cliente" | "lead";
  statusComercial?: "ativo" | "inativo" | "prospecto";
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  observacoes?: string | null;
  /** E01-S51: dado rico do Auvo só pra exibição (hoje: `contacts[]` completo). */
  detalhes?: Record<string, unknown> | null;
}

/** Grupo de clientes (E01-S27) associado a este cliente — E01-S51 (card Grupos na 360). */
export interface GrupoClienteResumo {
  id: string;
  nome: string;
}

/**
 * Item da carteira de clientes do PCM — ponto de entrada de navegação até a Visão 360. Combina
 * cadastro sincronizado do Auvo com sinais operacionais locais para busca, filtro e priorização.
 */
export interface ClienteResumo {
  id: string;
  nome: string;
  cnpj: string | null;
  ativo: boolean;
  auvoId?: number | null;
  tipo?: "cliente" | "lead";
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  observacoes?: string | null;
  statusComercial?: "ativo" | "inativo" | "prospecto";
  equipamentosAtivos?: number;
  osAbertas?: number;
  maiorScorePcm?: number;
  ultimaAtividadeEm?: string | null;
  cadastroCompleto?: boolean;
}

/**
 * Resumo de uma OS para os painéis Backlog (AC-3) e Histórico (AC-4). Um único tipo cobre os dois:
 * o backlog usa `scorePcm`/G·U·T para o badge de prioridade; o histórico usa `status`/`auvoSyncStatus`
 * (estado sincronizado do campo via Auvo).
 */
export interface OrdemServicoResumo {
  id: string;
  numero: string;
  titulo: string;
  categoria: string;
  status: string;
  scorePcm: number;
  gravidade: number | null;
  urgencia: number | null;
  tendencia: number | null;
  auvoSyncStatus: string | null;
  createdAt?: string | null;
  auvoSyncedAt?: string | null;
  localDescricao?: string | null;
  solicitante?: string | null;
  /** Ponto 4 do feedback (2026-07-10): descrição/técnico visíveis na 360 sem precisar abrir a OS. */
  descricao?: string | null;
  tecnicoFuncionarioId?: string | null;
  tecnicoNome?: string | null;
}

/** Equipamento vinculado ao cliente, vindo do cache plano do Auvo (E01-S11) — AC-6. */
export interface EquipamentoResumo {
  id: string;
  nome: string;
  auvoEquipmentId?: number | null;
  urlImagem?: string | null;
}

/**
 * Resultado de {@link Cliente360Gateway.listarEquipamentosCliente}. `"indisponivel"` é um terceiro
 * estado explícito, distinto de `[]` (lista vazia): sinaliza que o cache E01-S11 não existe/não pôde
 * ser consultado, sem lançar exceção — a UI o traduz num placeholder de degradação (AC-6).
 */
export type ResultadoEquipamentos = EquipamentoResumo[] | "indisponivel";

export interface Cliente360Metricas {
  osAbertas: number;
  backlogTotal: number;
  slaPercentual: number | null;
  equipamentosAtivos: number | null;
  ultimaAtividadeEm: string | null;
}

export interface Cliente360Evento {
  id: string;
  tipo: "os" | "inspecao" | "laudo" | "whatsapp" | "auvo";
  titulo: string;
  subtitulo: string | null;
  data: string;
  criticidade?: "neutra" | "atencao" | "critica" | "sucesso";
  /** Ponto 4 do feedback (2026-07-10) — só populado em eventos `tipo === "os"`. */
  tecnicoNome?: string | null;
  descricao?: string | null;
}

export interface QualidadeClienteResumo {
  inspecoes: Array<{
    id: string;
    titulo: string;
    status: string;
    dataInspecao: string;
    totalItens: number;
    itensNaoConformes: number;
  }>;
  laudos: Array<{
    id: string;
    numero: string;
    status: string;
    dataVistoria: string;
    nivelProtecao: string | null;
  }>;
}

export interface ClienteFormData {
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  observacoes?: string | null;
}

export interface ClienteCommand extends ClienteFormData {
  userId: string;
}

export interface EditarClienteCommand extends ClienteCommand {
  id: string;
}

export interface ExcluirClienteCommand {
  id: string;
  userId: string;
}

export interface Cliente360Gateway {
  /** Clientes não soft-deleted, ordenados por `nome` asc no servidor — lista de navegação (Task 18). */
  listarClientes(): Promise<ClienteResumo[]>;
  /** Cabeçalho do cliente (`deleted_at IS NULL`); `null` quando não existe/soft-deleted (AC-8). */
  buscarCliente(id: string): Promise<ClienteHeader | null>;
  /** OS em aberto, já ordenadas por `score_pcm` desc no servidor (AC-3). */
  listarBacklogCliente(id: string): Promise<OrdemServicoResumo[]>;
  /** OS finalizadas/canceladas, ordenadas por `auvo_synced_at` desc, fallback `created_at` (AC-4). */
  listarHistoricoCliente(id: string): Promise<OrdemServicoResumo[]>;
  /** Equipamentos vinculados via `auvo_id`, ou `"indisponivel"` se o cache não existir (AC-6). */
  listarEquipamentosCliente(
    clienteId: string,
    auvoId: number | null,
  ): Promise<ResultadoEquipamentos>;
  /** Eventos recentes consolidados de OS, inspeções, laudos e snapshots Auvo. */
  listarEventosCliente(id: string): Promise<Cliente360Evento[]>;
  /** Resumo operacional de qualidade do cliente. */
  listarQualidadeCliente(id: string): Promise<QualidadeClienteResumo>;
  /** Grupos de clientes (E01-S27) que incluem este cliente — E01-S51. */
  listarGruposCliente(id: string): Promise<GrupoClienteResumo[]>;
  criarCliente?(input: ClienteCommand): Promise<ClienteHeader>;
  editarCliente?(input: EditarClienteCommand): Promise<ClienteHeader>;
  excluirCliente?(input: ExcluirClienteCommand): Promise<void>;
}
