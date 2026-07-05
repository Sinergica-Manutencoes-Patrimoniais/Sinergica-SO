// Implementa Cliente360Gateway via @supabase/supabase-js — único ponto da feature que conhece o
// SDK (ver docs/ARCHITECTURE.md, regra de dependência da infrastructure/). Toda ordenação/filtro
// de status roda no SERVIDOR (reusa idx_os_score_desc; sem recálculo no client), mantendo a mesma
// verdade do backlog GUT (E01-S01) e do Hub de OS.
import { supabase } from "../../../lib/supabase-client";
import type {
  Cliente360Evento,
  Cliente360Gateway,
  ClienteHeader,
  ClienteResumo,
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

const COLUNAS_OS =
  "id,numero,titulo,categoria,status,score_pcm,gravidade,urgencia,tendencia,auvo_sync_status,auvo_synced_at,local_descricao,solicitante,created_at" as const;

// Lista de status de histórico como literal PostgREST — derivada da fonte única do domínio, nunca
// redigitada aqui (mantém `('finalizado','cancelado')` num só lugar).
const STATUS_HISTORICO_LISTA = `(${STATUS_HISTORICO.join(",")})`;

function mapearOs(row: OrdemServicoRow): OrdemServicoResumo {
  return {
    id: row.id,
    numero: row.numero,
    titulo: row.titulo,
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
  };
}

function ordenarEventos(eventos: Cliente360Evento[]): Cliente360Evento[] {
  return eventos.sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12);
}

function erroColunaAusente(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    /column|coluna/i.test(error?.message ?? "")
  );
}

export const supabaseCliente360Adapter: Cliente360Gateway = {
  async listarClientes(): Promise<ClienteResumo[]> {
    // Task 18: lista mínima de clientes para navegação até a Visão 360. Mesma tabela e MESMA RLS de
    // buscarCliente (SELECT em pcm.clientes gated por módulo pcm — 0009_E00-S09_rls_modulos.sql);
    // nenhuma permissão nova. Ordenação por nome asc no SERVIDOR (sem sort no client), soft-deletes
    // excluídos. Sem filtro/busca/paginação nesta v1 (fora de escopo da lista mínima).
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select(
        "id,nome,cnpj,auvo_id,ativo,cidade,estado,contato_telefone,contato_email,status_comercial",
      )
      .is("deleted_at", null)
      .order("nome", { ascending: true });
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
    return (data ?? []).map((row) => ({
      id: row.id as string,
      nome: row.nome as string,
      cnpj: (row.cnpj as string | null) ?? null,
      ativo: row.ativo as boolean,
      auvoId: (row.auvo_id as number | null) ?? null,
      cidade: (row.cidade as string | null) ?? null,
      estado: (row.estado as string | null) ?? null,
      contatoTelefone: (row.contato_telefone as string | null) ?? null,
      contatoEmail: (row.contato_email as string | null) ?? null,
      statusComercial: row.status_comercial as "ativo" | "inativo" | "prospecto",
    }));
  },

  async buscarCliente(id): Promise<ClienteHeader | null> {
    // maybeSingle() (não single()): 0 linhas devolve data=null em vez de lançar erro — é o que
    // sinaliza "cliente não encontrado/soft-deleted" para AC-8, sem virar exceção.
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select(
        "id,nome,cnpj,auvo_id,ativo,tipo,status_comercial,endereco,cidade,estado,cep,contato_nome,contato_telefone,contato_email,observacoes",
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
    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .select(COLUNAS_OS)
      .eq("client_id", id)
      .is("deleted_at", null)
      .not("status", "in", STATUS_HISTORICO_LISTA)
      .order("score_pcm", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapearOs(row as OrdemServicoRow));
  },

  async listarHistoricoCliente(id): Promise<OrdemServicoResumo[]> {
    // AC-4: OS finalizadas/canceladas, separadas do backlog. ORDER BY auvo_synced_at DESC NULLS
    // LAST, created_at DESC — o nullsFirst:false empurra os não-sincronizados para o fim, sem
    // coalesce manual. limit(50): a spec permite paginar o histórico (o backlog é que nunca pode
    // ser cortado); 50 é ponto de partida, ajustável (AUTO-DECISION, não é decisão de produto).
    const { data, error } = await supabase
      .schema("pcm")
      .from("ordens_servico")
      .select(COLUNAS_OS)
      .eq("client_id", id)
      .is("deleted_at", null)
      .in("status", [...STATUS_HISTORICO])
      .order("auvo_synced_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((row) => mapearOs(row as OrdemServicoRow));
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
      .from("equipamentos_cache")
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
    const [os, inspecoes, laudos] = await Promise.all([
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
    ]);

    if (os.error) throw os.error;
    if (inspecoes.error) throw inspecoes.error;
    if (laudos.error) throw laudos.error;

    const eventosOs = ((os.data ?? []) as OrdemServicoRow[]).map((ordem) => ({
      id: `os-${ordem.id}`,
      tipo: "os" as const,
      titulo: `OS ${ordem.numero} aberta — ${ordem.titulo}`,
      subtitulo: ordem.local_descricao ?? ordem.solicitante ?? ordem.categoria,
      data: ordem.created_at,
      criticidade: ordem.score_pcm >= 80 ? ("critica" as const) : ("atencao" as const),
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

    return ordenarEventos([...eventosOs, ...eventosInspecao, ...eventosLaudo]);
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
};
