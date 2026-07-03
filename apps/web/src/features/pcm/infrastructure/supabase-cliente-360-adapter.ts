// Implementa Cliente360Gateway via @supabase/supabase-js — único ponto da feature que conhece o
// SDK (ver docs/ARCHITECTURE.md, regra de dependência da infrastructure/). Toda ordenação/filtro
// de status roda no SERVIDOR (reusa idx_os_score_desc; sem recálculo no client), mantendo a mesma
// verdade do backlog GUT (E01-S01) e do Hub de OS.
import { supabase } from "../../../lib/supabase-client";
import type {
  Cliente360Gateway,
  ClienteHeader,
  OrdemServicoResumo,
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
}

const COLUNAS_OS =
  "id,numero,titulo,categoria,status,score_pcm,gravidade,urgencia,tendencia,auvo_sync_status" as const;

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
  };
}

export const supabaseCliente360Adapter: Cliente360Gateway = {
  async buscarCliente(id): Promise<ClienteHeader | null> {
    // maybeSingle() (não single()): 0 linhas devolve data=null em vez de lançar erro — é o que
    // sinaliza "cliente não encontrado/soft-deleted" para AC-8, sem virar exceção.
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select("id,nome,cnpj,auvo_id,ativo")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      nome: data.nome,
      cnpj: data.cnpj,
      auvoId: data.auvo_id,
      ativo: data.ativo,
    };
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

    // pcm.equipamentos_cache é de E01-S11, que NÃO está mergeada nesta build (confirmado: sem
    // migration 0012). A ausência é detectada pelo código de erro do PostgREST — PGRST205 (relação
    // fora do schema cache, esperado quando a tabela nunca foi criada) ou 42P01 (relation does not
    // exist). Nesses casos devolve "indisponivel" (degradação graciosa); qualquer OUTRO erro é
    // relançado — degradação silenciosa não pode mascarar um bug real (permissão, rede, etc.).
    //
    // ASSUNÇÃO DE ACOPLAMENTO (E01-S11): o nome da coluna de vínculo (`cliente_auvo_id`) e o campo
    // `nome` seguem o modelo de dados assumido da spec E01-S11 (equipamento vinculado ao cliente
    // via pcm.clientes.auvo_id). Como a tabela ainda não existe, esta query nunca roda com sucesso
    // nesta build (sempre cai em "indisponivel") — os nomes devem ser reconciliados quando E01-S11
    // mergear. Registrado em tasks.md (não é SPEC_DEVIATION: a spec não define o schema do cache).
    const { data, error } = await supabase
      .schema("pcm")
      .from("equipamentos_cache")
      .select("id,nome")
      .eq("cliente_auvo_id", auvoId)
      .eq("ativo", true);

    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") return "indisponivel";
      throw error;
    }
    return (data ?? []).map((e) => ({ id: e.id as string, nome: e.nome as string }));
  },
};
