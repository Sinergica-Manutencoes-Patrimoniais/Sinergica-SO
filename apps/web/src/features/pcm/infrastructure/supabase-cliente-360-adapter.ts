// Implementa Cliente360Gateway via @supabase/supabase-js — único ponto da feature que conhece o
// SDK (ver docs/ARCHITECTURE.md, regra de dependência da infrastructure/). Toda ordenação/filtro
// de status roda no SERVIDOR (reusa idx_os_score_desc; sem recálculo no client), mantendo a mesma
// verdade do backlog GUT (E01-S01) e do Hub de OS.
import { supabase } from "../../../lib/supabase-client";
import type {
  Cliente360Evento,
  Cliente360Gateway,
  ClienteCommand,
  ClienteHeader,
  ClienteResumo,
  EditarClienteCommand,
  ExcluirClienteCommand,
  GrupoClienteResumo,
  OrdemServicoResumo,
  QualidadeClienteResumo,
  ResultadoEquipamentos,
} from "../application/cliente-360-gateway";
import { STATUS_HISTORICO } from "../domain/cliente-360";

// Linha de OS como vem do PostgREST (snake_case). Mapeada para OrdemServicoResumo (camelCase).
interface OrdemServicoRow {
  id: string;
  numero: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  status: string;
  score_pcm: number;
  gravidade: number | null;
  urgencia: number | null;
  tendencia: number | null;
  auvo_sync_status: string | null;
  auvo_synced_at: string | null;
  local_descricao: string | null;
  solicitante: string | null;
  created_at: string;
  tecnico_funcionario_id: string | null;
}

interface FuncionarioRow {
  id: string;
  nome: string;
}

interface ClienteRow {
  id: string;
  nome: string;
  cnpj: string | null;
  auvo_id: number | null;
  ativo: boolean;
  tipo: "cliente" | "lead";
  status_comercial: "ativo" | "inativo" | "prospecto";
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  observacoes: string | null;
  updated_at: string | null;
  detalhes?: Record<string, unknown> | null;
}

interface GrupoClienteRow {
  id: string;
  nome: string;
}

interface InspecaoEventoRow {
  id: string;
  titulo: string;
  status: string;
  data_inspecao: string;
  created_at: string;
  total_itens: number;
  itens_nao_conformes: number;
}

interface LaudoEventoRow {
  id: string;
  numero: string;
  status: string;
  data_vistoria: string;
  created_at: string;
  nivel_protecao: string | null;
}

interface OsClienteListaRow {
  client_id: string;
  status: string;
  score_pcm: number;
  created_at: string;
  auvo_synced_at: string | null;
}

interface EquipamentoClienteListaRow {
  auvo_customer_id: number | null;
  ativo: boolean;
  updated_at: string | null;
}

const COLUNAS_OS =
  "id,numero,titulo,descricao,categoria,status,score_pcm,gravidade,urgencia,tendencia,auvo_sync_status,auvo_synced_at,local_descricao,solicitante,created_at,tecnico_funcionario_id" as const;

// Lista de status de histórico como literal PostgREST — derivada da fonte única do domínio, nunca
// redigitada aqui (mantém `('finalizado','cancelado')` num só lugar).
const STATUS_HISTORICO_LISTA = `(${STATUS_HISTORICO.join(",")})`;

function mapearClienteCommand(input: ClienteCommand | EditarClienteCommand) {
  return {
    nome: input.nome,
    cnpj: input.cnpj,
    endereco: input.endereco,
    cidade: input.cidade,
    estado: input.estado,
    cep: input.cep,
    contato_nome: input.contatoNome,
    contato_telefone: input.contatoTelefone,
    contato_email: input.contatoEmail,
    observacoes: input.observacoes,
    tipo: "cliente",
    status_comercial: "ativo",
    ativo: true,
    auvo_sync_status: "pending",
    updated_by: input.userId,
  };
}

function mapearOs(row: OrdemServicoRow, funcionarios: Map<string, string>): OrdemServicoResumo {
  return {
    id: row.id,
    numero: row.numero,
    titulo: row.titulo,
    descricao: row.descricao,
    categoria: row.categoria,
    status: row.status,
    scorePcm: row.score_pcm,
    gravidade: row.gravidade,
    urgencia: row.urgencia,
    tendencia: row.tendencia,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncedAt: row.auvo_synced_at,
    localDescricao: row.local_descricao,
    solicitante: row.solicitante,
    createdAt: row.created_at,
    tecnicoFuncionarioId: row.tecnico_funcionario_id,
    tecnicoNome: row.tecnico_funcionario_id
      ? (funcionarios.get(row.tecnico_funcionario_id) ?? null)
      : null,
  };
}

function mapearCliente(row: ClienteRow): ClienteHeader {
  return {
    id: row.id,
    nome: row.nome,
    cnpj: row.cnpj,
    auvoId: row.auvo_id,
    ativo: row.ativo,
    tipo: row.tipo,
    statusComercial: row.status_comercial,
    endereco: row.endereco,
    cidade: row.cidade,
    estado: row.estado,
    cep: row.cep,
    contatoNome: row.contato_nome,
    contatoTelefone: row.contato_telefone,
    contatoEmail: row.contato_email,
    observacoes: row.observacoes,
    detalhes: row.detalhes ?? null,
  };
}

function ordenarEventos(eventos: Cliente360Evento[]): Cliente360Evento[] {
  return eventos.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12);
}

/** Resolve nome do técnico responsável — mesmo padrão de `supabase-hub-os-adapter.ts`. Ponto 4 do
 * feedback (2026-07-10): quem acessa a 360 (ex.: Fabrício) precisa ver quem atendeu, não só a OS. */
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

function erroColunaAusente(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    /column|coluna/i.test(error?.message ?? "")
  );
}

function rotuloStatusOperacional(status: string): string {
  const labels: Record<string, string> = {
    solicitacao: "Solicitação",
    triagem: "Triagem",
    planejamento: "Planejamento",
    em_execucao: "Em execução",
    aguardando_cliente: "Aguardando cliente",
    finalizado: "Finalizada",
    cancelado: "Cancelada",
  };
  return labels[status] ?? status;
}

export const supabaseCliente360Adapter: Cliente360Gateway = {
  async criarCliente(input: ClienteCommand): Promise<ClienteHeader> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .insert({
        ...mapearClienteCommand(input),
        created_by: input.userId,
      })
      .select(
        "id,nome,cnpj,auvo_id,ativo,tipo,status_comercial,endereco,cidade,estado,cep,contato_nome,contato_telefone,contato_email,observacoes",
      )
      .single();

    if (error) throw error;
    return mapearCliente(data as ClienteRow);
  },

  async editarCliente(input: EditarClienteCommand): Promise<ClienteHeader> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .update({
        ...mapearClienteCommand(input),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .select(
        "id,nome,cnpj,auvo_id,ativo,tipo,status_comercial,endereco,cidade,estado,cep,contato_nome,contato_telefone,contato_email,observacoes",
      )
      .single();

    if (error) throw error;
    return mapearCliente(data as ClienteRow);
  },

  async excluirCliente(input: ExcluirClienteCommand): Promise<void> {
    const abertas = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .eq("client_id", input.id)
      .is("deleted_at", null)
      .not("status", "in", STATUS_HISTORICO_LISTA);

    if (abertas.error) throw abertas.error;
    if ((abertas.count ?? 0) > 0) {
      throw new Error("Cliente possui OS aberta. Finalize ou cancele as OS antes de excluir.");
    }

    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("clientes")
      .update({
        ativo: false,
        status_comercial: "inativo",
        deleted_at: agora,
        auvo_sync_status: "pending",
        updated_at: agora,
        updated_by: input.userId,
      })
      .eq("id", input.id);

    if (error) throw error;
  },

  async listarClientes(): Promise<ClienteResumo[]> {
    // A lista virou um cockpit de carteira: além do cadastro Auvo, cruza ativos e OS para permitir
    // filtro operacional sem novas tabelas nem mutação local.
    const [clientes, ordens, equipamentos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select(
          "id,nome,cnpj,auvo_id,ativo,tipo,status_comercial,endereco,cidade,estado,cep,contato_nome,contato_telefone,contato_email,observacoes,updated_at",
        )
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      supabase
        .schema("pcm")
        .from("ordens_servico")
        .select("client_id,status,score_pcm,created_at,auvo_synced_at")
        .is("deleted_at", null),
      supabase.schema("pcm").from("equipamentos").select("auvo_customer_id,ativo,updated_at"),
    ]);
    const { data, error } = clientes;
    if (error && erroColunaAusente(error)) {
      const fallback = await supabase
        .schema("pcm")
        .from("clientes")
        .select("id,nome,cnpj,auvo_id,ativo")
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => ({
        id: row.id as string,
        nome: row.nome as string,
        cnpj: (row.cnpj as string | null) ?? null,
        ativo: row.ativo as boolean,
        auvoId: (row.auvo_id as number | null) ?? null,
      }));
    }
    if (error) throw error;
    if (ordens.error) throw ordens.error;
    if (equipamentos.error && !["PGRST205", "42P01"].includes(equipamentos.error.code ?? "")) {
      throw equipamentos.error;
    }

    const ordensPorCliente = new Map<
      string,
      { abertas: number; maiorScore: number; ultimaAtividadeEm: string | null }
    >();
    for (const ordem of (ordens.data ?? []) as OsClienteListaRow[]) {
      const atual = ordensPorCliente.get(ordem.client_id) ?? {
        abertas: 0,
        maiorScore: 0,
        ultimaAtividadeEm: null,
      };
      if (!STATUS_HISTORICO.includes(ordem.status as (typeof STATUS_HISTORICO)[number])) {
        atual.abertas += 1;
      }
      atual.maiorScore = Math.max(atual.maiorScore, ordem.score_pcm ?? 0);
      const dataAtividade = ordem.auvo_synced_at ?? ordem.created_at;
      if (dataAtividade && (!atual.ultimaAtividadeEm || dataAtividade > atual.ultimaAtividadeEm)) {
        atual.ultimaAtividadeEm = dataAtividade;
      }
      ordensPorCliente.set(ordem.client_id, atual);
    }

    const equipamentosPorAuvoId = new Map<
      number,
      { total: number; ultimaAtualizacao: string | null }
    >();
    for (const equipamento of ((equipamentos.data ?? []) as EquipamentoClienteListaRow[]).filter(
      (item) => item.ativo,
    )) {
      if (equipamento.auvo_customer_id === null) continue;
      const atual = equipamentosPorAuvoId.get(equipamento.auvo_customer_id) ?? {
        total: 0,
        ultimaAtualizacao: null,
      };
      atual.total += 1;
      if (
        equipamento.updated_at &&
        (!atual.ultimaAtualizacao || equipamento.updated_at > atual.ultimaAtualizacao)
      ) {
        atual.ultimaAtualizacao = equipamento.updated_at;
      }
      equipamentosPorAuvoId.set(equipamento.auvo_customer_id, atual);
    }

    return ((data ?? []) as ClienteRow[]).map((row) => {
      const osResumo = ordensPorCliente.get(row.id);
      const eqResumo = row.auvo_id === null ? undefined : equipamentosPorAuvoId.get(row.auvo_id);
      const ultimaAtividadeEm =
        [osResumo?.ultimaAtividadeEm, eqResumo?.ultimaAtualizacao, row.updated_at]
          .filter((valor): valor is string => Boolean(valor))
          .sort((a, b) => b.localeCompare(a))[0] ?? null;

      return {
        id: row.id,
        nome: row.nome,
        cnpj: row.cnpj,
        ativo: row.ativo,
        auvoId: row.auvo_id,
        tipo: row.tipo,
        statusComercial: row.status_comercial,
        endereco: row.endereco,
        cidade: row.cidade,
        estado: row.estado,
        cep: row.cep,
        contatoNome: row.contato_nome,
        contatoTelefone: row.contato_telefone,
        contatoEmail: row.contato_email,
        observacoes: row.observacoes,
        equipamentosAtivos: eqResumo?.total ?? 0,
        osAbertas: osResumo?.abertas ?? 0,
        maiorScorePcm: osResumo?.maiorScore ?? 0,
        ultimaAtividadeEm,
        cadastroCompleto: Boolean(
          row.auvo_id &&
            row.endereco &&
            (row.cidade || row.estado) &&
            (row.contato_telefone || row.contato_email),
        ),
      };
    });
  },

  async buscarCliente(id): Promise<ClienteHeader | null> {
    // maybeSingle() (não single()): 0 linhas devolve data=null em vez de lançar erro — é o que
    // sinaliza "cliente não encontrado/soft-deleted" para AC-8, sem virar exceção.
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select(
        "id,nome,cnpj,auvo_id,ativo,tipo,status_comercial,endereco,cidade,estado,cep,contato_nome,contato_telefone,contato_email,observacoes,detalhes",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error && erroColunaAusente(error)) {
      const fallback = await supabase
        .schema("pcm")
        .from("clientes")
        .select("id,nome,cnpj,auvo_id,ativo")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      if (!fallback.data) return null;
      return {
        id: fallback.data.id,
        nome: fallback.data.nome,
        cnpj: fallback.data.cnpj,
        auvoId: fallback.data.auvo_id,
        ativo: fallback.data.ativo,
      };
    }
    if (error) throw error;
    if (!data) return null;

    return mapearCliente(data as ClienteRow);
  },

  async listarBacklogCliente(id): Promise<OrdemServicoResumo[]> {
    // AC-3: OS em aberto (status NOT IN histórico), ordenadas por score_pcm desc no servidor,
    // desempate determinístico por created_at desc. Sem sort no client.
    const [{ data, error }, funcionarios] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ordens_servico")
        .select(COLUNAS_OS)
        .eq("client_id", id)
        .is("deleted_at", null)
        .not("status", "in", STATUS_HISTORICO_LISTA)
        .order("score_pcm", { ascending: false })
        .order("created_at", { ascending: false }),
      funcionariosPorId(),
    ]);
    if (error) throw error;
    return (data ?? []).map((row) => mapearOs(row as OrdemServicoRow, funcionarios));
  },

  async listarHistoricoCliente(id): Promise<OrdemServicoResumo[]> {
    // AC-4: OS finalizadas/canceladas, separadas do backlog. ORDER BY auvo_synced_at DESC NULLS
    // LAST, created_at DESC — o nullsFirst:false empurra os não-sincronizados para o fim, sem
    // coalesce manual. limit(50): a spec permite paginar o histórico (o backlog é que nunca pode
    // ser cortado); 50 é ponto de partida, ajustável (AUTO-DECISION, não é decisão de produto).
    const [{ data, error }, funcionarios] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ordens_servico")
        .select(COLUNAS_OS)
        .eq("client_id", id)
        .is("deleted_at", null)
        .in("status", [...STATUS_HISTORICO])
        .order("auvo_synced_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(50),
      funcionariosPorId(),
    ]);
    if (error) throw error;
    return (data ?? []).map((row) => mapearOs(row as OrdemServicoRow, funcionarios));
  },

  async listarEquipamentosCliente(_clienteId, auvoId): Promise<ResultadoEquipamentos> {
    // AC-6, caso de borda "auvo_id IS NULL": sem chave de vínculo com o Auvo → estado vazio, sem
    // sequer consultar (não é erro, é ausência de vínculo).
    if (auvoId === null) return [];

    // E01-S16: E01-S11 já definiu o vínculo real como `auvo_customer_id` (FK para
    // pcm.clientes.auvo_id). Não consultar coluna inventada/obsoleta (`cliente_auvo_id`), senão o
    // painel ficaria "indisponível" mesmo com o cache mergeado e populado.
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos")
      .select("id,nome,auvo_equipment_id")
      .eq("auvo_customer_id", auvoId)
      .eq("ativo", true);

    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") return "indisponivel";
      throw error;
    }
    return (data ?? []).map((e) => ({
      id: e.id as string,
      nome: e.nome as string,
      auvoEquipmentId: (e.auvo_equipment_id as number | null) ?? null,
    }));
  },

  async listarEventosCliente(id): Promise<Cliente360Evento[]> {
    const [cliente, os, inspecoes, laudos, funcionarios] = await Promise.all([
      supabase
        .schema("pcm")
        .from("clientes")
        .select("auvo_id,updated_at")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .schema("pcm")
        .from("ordens_servico")
        .select(COLUNAS_OS)
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .schema("pcm")
        .from("inspecoes")
        .select("id,titulo,status,data_inspecao,created_at,total_itens,itens_nao_conformes")
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("data_inspecao", { ascending: false })
        .limit(5),
      supabase
        .schema("pcm")
        .from("laudos_spda")
        .select("id,numero,status,data_vistoria,created_at,nivel_protecao")
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("data_vistoria", { ascending: false })
        .limit(5),
      funcionariosPorId(),
    ]);

    if (cliente.error) throw cliente.error;
    if (os.error) throw os.error;
    if (inspecoes.error) throw inspecoes.error;
    if (laudos.error) throw laudos.error;

    // Ponto 4 do feedback (2026-07-10): quem acessa a 360 durante uma ligação do cliente precisa
    // ver, sem clicar em mais nada, quem atendeu (técnico) e o que foi feito (descrição) — não só
    // a categoria. `tecnicoNome`/`descricao` viajam separados do `subtitulo` pra render estruturado.
    const eventosOs = ((os.data ?? []) as OrdemServicoRow[]).map((ordem) => ({
      id: `os-${ordem.id}`,
      tipo: "os" as const,
      titulo: `OS ${ordem.numero} · ${rotuloStatusOperacional(ordem.status)}`,
      subtitulo: [ordem.titulo, ordem.local_descricao ?? ordem.solicitante ?? ordem.categoria]
        .filter(Boolean)
        .join(" — "),
      data: ordem.auvo_synced_at ?? ordem.created_at,
      criticidade: STATUS_HISTORICO.includes(ordem.status as (typeof STATUS_HISTORICO)[number])
        ? ("sucesso" as const)
        : ordem.score_pcm >= 80
          ? ("critica" as const)
          : ("atencao" as const),
      tecnicoNome: ordem.tecnico_funcionario_id
        ? (funcionarios.get(ordem.tecnico_funcionario_id) ?? null)
        : null,
      descricao: ordem.descricao,
    }));

    const eventosInspecao = ((inspecoes.data ?? []) as InspecaoEventoRow[]).map((inspecao) => ({
      id: `inspecao-${inspecao.id}`,
      tipo: "inspecao" as const,
      titulo: `Inspeção ${inspecao.titulo}`,
      subtitulo:
        inspecao.itens_nao_conformes > 0
          ? `${inspecao.itens_nao_conformes} inconformidade(s) em ${inspecao.total_itens} item(ns)`
          : inspecao.status,
      data: inspecao.created_at ?? inspecao.data_inspecao,
      criticidade: inspecao.itens_nao_conformes > 0 ? ("critica" as const) : ("sucesso" as const),
    }));

    const eventosLaudo = ((laudos.data ?? []) as LaudoEventoRow[]).map((laudo) => ({
      id: `laudo-${laudo.id}`,
      tipo: "laudo" as const,
      titulo: `Laudo SPDA ${laudo.numero}`,
      subtitulo: laudo.nivel_protecao
        ? `Nível ${laudo.nivel_protecao} · ${laudo.status}`
        : laudo.status,
      data: laudo.created_at ?? laudo.data_vistoria,
      criticidade:
        laudo.status === "concluido" || laudo.status === "assinado"
          ? ("sucesso" as const)
          : ("neutra" as const),
    }));

    const eventosAuvo: Cliente360Evento[] = [];
    const auvoId = (cliente.data?.auvo_id as number | null | undefined) ?? null;
    if (cliente.data?.updated_at) {
      eventosAuvo.push({
        id: `auvo-cadastro-${id}`,
        tipo: "auvo",
        titulo: "Cadastro Auvo sincronizado",
        subtitulo: auvoId ? `Cliente Auvo #${auvoId}` : "Cliente ainda sem vínculo Auvo",
        data: cliente.data.updated_at as string,
        criticidade: auvoId ? "sucesso" : "atencao",
      });
    }

    if (auvoId !== null) {
      const equipamentos = await supabase
        .schema("pcm")
        .from("equipamentos")
        .select("auvo_equipment_id,updated_at")
        .eq("auvo_customer_id", auvoId)
        .eq("ativo", true)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!equipamentos.error && equipamentos.data?.[0]?.updated_at) {
        eventosAuvo.push({
          id: `auvo-ativos-${auvoId}`,
          tipo: "auvo",
          titulo: "Ativos Auvo atualizados",
          subtitulo: `Último equipamento no cache: #${equipamentos.data[0].auvo_equipment_id}`,
          data: equipamentos.data[0].updated_at as string,
          criticidade: "neutra",
        });
      }
    }

    return ordenarEventos([...eventosOs, ...eventosInspecao, ...eventosLaudo, ...eventosAuvo]);
  },

  async listarQualidadeCliente(id): Promise<QualidadeClienteResumo> {
    const [inspecoes, laudos] = await Promise.all([
      supabase
        .schema("pcm")
        .from("inspecoes")
        .select("id,titulo,status,data_inspecao,total_itens,itens_nao_conformes")
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("data_inspecao", { ascending: false })
        .limit(10),
      supabase
        .schema("pcm")
        .from("laudos_spda")
        .select("id,numero,status,data_vistoria,nivel_protecao")
        .eq("client_id", id)
        .is("deleted_at", null)
        .order("data_vistoria", { ascending: false })
        .limit(10),
    ]);

    if (inspecoes.error) throw inspecoes.error;
    if (laudos.error) throw laudos.error;

    return {
      inspecoes: ((inspecoes.data ?? []) as InspecaoEventoRow[]).map((inspecao) => ({
        id: inspecao.id,
        titulo: inspecao.titulo,
        status: inspecao.status,
        dataInspecao: inspecao.data_inspecao,
        totalItens: inspecao.total_itens,
        itensNaoConformes: inspecao.itens_nao_conformes,
      })),
      laudos: ((laudos.data ?? []) as LaudoEventoRow[]).map((laudo) => ({
        id: laudo.id,
        numero: laudo.numero,
        status: laudo.status,
        dataVistoria: laudo.data_vistoria,
        nivelProtecao: laudo.nivel_protecao,
      })),
    };
  },

  /** E01-S51: grupos (E01-S27, `pcm.cliente_grupos.cliente_ids uuid[]`) que incluem este cliente. */
  async listarGruposCliente(id): Promise<GrupoClienteResumo[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("cliente_grupos")
      .select("id,nome")
      .is("deleted_at", null)
      .contains("cliente_ids", [id])
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as GrupoClienteRow[]).map((grupo) => ({ id: grupo.id, nome: grupo.nome }));
  },
};
