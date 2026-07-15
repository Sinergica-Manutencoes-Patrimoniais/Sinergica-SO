import { supabase } from "../../../lib/supabase-client";
import type {
  AtribuirUnidadeCommand,
  BaixarUnidadeCommand,
  DevolverUnidadeCommand,
  FerramentaUnidadesGateway,
  GerarUnidadesCommand,
} from "../application/ferramenta-unidades-gateway";
import type {
  CondicaoDevolucao,
  FerramentaUnidadeItem,
  MovimentacaoFerramentaItem,
  StatusUnidadeFerramenta,
  TipoMovimentacaoFerramenta,
} from "../domain/ferramenta-unidades";

interface UnidadeRow {
  id: string;
  ferramenta_id: string;
  codigo: string;
  status: StatusUnidadeFerramenta;
  atribuida_a: string | null;
  atribuida_em: string | null;
  motivo_baixa: string | null;
}

interface MovimentacaoRow {
  id: string;
  unidade_id: string;
  tipo: TipoMovimentacaoFerramenta;
  funcionario_id: string | null;
  condicao: CondicaoDevolucao | null;
  motivo: string | null;
  data_movimento: string;
}

const UNIDADE_COLS =
  "id,ferramenta_id,codigo,status,atribuida_a,atribuida_em,motivo_baixa" as const;
const MOVIMENTACAO_COLS =
  "id,unidade_id,tipo,funcionario_id,condicao,motivo,data_movimento" as const;

async function mapasDeApoio(): Promise<{
  ferramentas: Map<string, string>;
  funcionarios: Map<string, string>;
}> {
  const [ferramentas, funcionarios] = await Promise.all([
    supabase.schema("pcm").from("ferramentas").select("id,nome").is("deleted_at", null),
    supabase.schema("pcm").from("funcionarios").select("id,nome").is("deleted_at", null),
  ]);
  if (ferramentas.error) throw ferramentas.error;
  if (funcionarios.error) throw funcionarios.error;
  return {
    ferramentas: new Map((ferramentas.data ?? []).map((f) => [f.id as string, f.nome as string])),
    funcionarios: new Map((funcionarios.data ?? []).map((f) => [f.id as string, f.nome as string])),
  };
}

function mapUnidade(
  row: UnidadeRow,
  ferramentas: Map<string, string>,
  funcionarios: Map<string, string>,
): FerramentaUnidadeItem {
  return {
    id: row.id,
    ferramentaId: row.ferramenta_id,
    ferramentaNome: ferramentas.get(row.ferramenta_id) ?? "Ferramenta removida",
    codigo: row.codigo,
    status: row.status,
    atribuidaA: row.atribuida_a,
    atribuidaANome: row.atribuida_a
      ? (funcionarios.get(row.atribuida_a) ?? "Técnico removido")
      : null,
    atribuidaEm: row.atribuida_em,
    motivoBaixa: row.motivo_baixa,
  };
}

function mapMovimentacao(
  row: MovimentacaoRow,
  unidades: Map<string, { codigo: string; ferramentaNome: string }>,
  funcionarios: Map<string, string>,
): MovimentacaoFerramentaItem {
  const unidade = unidades.get(row.unidade_id);
  return {
    id: row.id,
    unidadeId: row.unidade_id,
    unidadeCodigo: unidade?.codigo ?? "?",
    ferramentaNome: unidade?.ferramentaNome ?? "Ferramenta removida",
    tipo: row.tipo,
    funcionarioId: row.funcionario_id,
    funcionarioNome: row.funcionario_id
      ? (funcionarios.get(row.funcionario_id) ?? "Técnico removido")
      : null,
    condicao: row.condicao,
    motivo: row.motivo,
    dataMovimento: row.data_movimento,
  };
}

export const supabaseFerramentaUnidadesAdapter: FerramentaUnidadesGateway = {
  async listarUnidades() {
    const [unidades, apoio] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ferramenta_unidades")
        .select(UNIDADE_COLS)
        .order("codigo", { ascending: true }),
      mapasDeApoio(),
    ]);
    if (unidades.error) throw unidades.error;
    return ((unidades.data ?? []) as UnidadeRow[]).map((row) =>
      mapUnidade(row, apoio.ferramentas, apoio.funcionarios),
    );
  },

  async listarHistoricoUnidade(unidadeId: string) {
    const [movimentacoes, unidadeAtual, apoio] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ferramenta_movimentacoes")
        .select(MOVIMENTACAO_COLS)
        .eq("unidade_id", unidadeId)
        .order("data_movimento", { ascending: false }),
      supabase
        .schema("pcm")
        .from("ferramenta_unidades")
        .select(UNIDADE_COLS)
        .eq("id", unidadeId)
        .maybeSingle(),
      mapasDeApoio(),
    ]);
    if (movimentacoes.error) throw movimentacoes.error;
    if (unidadeAtual.error) throw unidadeAtual.error;
    const unidadesMap = new Map<string, { codigo: string; ferramentaNome: string }>();
    if (unidadeAtual.data) {
      const row = unidadeAtual.data as UnidadeRow;
      unidadesMap.set(row.id, {
        codigo: row.codigo,
        ferramentaNome: apoio.ferramentas.get(row.ferramenta_id) ?? "Ferramenta removida",
      });
    }
    return ((movimentacoes.data ?? []) as MovimentacaoRow[]).map((row) =>
      mapMovimentacao(row, unidadesMap, apoio.funcionarios),
    );
  },

  async listarHistoricoFuncionario(funcionarioId: string) {
    const [movimentacoes, unidades, apoio] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ferramenta_movimentacoes")
        .select(MOVIMENTACAO_COLS)
        .eq("funcionario_id", funcionarioId)
        .order("data_movimento", { ascending: false }),
      supabase.schema("pcm").from("ferramenta_unidades").select(UNIDADE_COLS),
      mapasDeApoio(),
    ]);
    if (movimentacoes.error) throw movimentacoes.error;
    if (unidades.error) throw unidades.error;
    const unidadesMap = new Map(
      ((unidades.data ?? []) as UnidadeRow[]).map((row) => [
        row.id,
        {
          codigo: row.codigo,
          ferramentaNome: apoio.ferramentas.get(row.ferramenta_id) ?? "Ferramenta removida",
        },
      ]),
    );
    return ((movimentacoes.data ?? []) as MovimentacaoRow[]).map((row) =>
      mapMovimentacao(row, unidadesMap, apoio.funcionarios),
    );
  },

  async gerarUnidades(input: GerarUnidadesCommand) {
    const linhas = Array.from({ length: input.quantidade }, () => ({
      ferramenta_id: input.ferramentaId,
      created_by: input.userId,
      updated_by: input.userId,
    }));
    const { data, error } = await supabase
      .schema("pcm")
      .from("ferramenta_unidades")
      .insert(linhas)
      .select(UNIDADE_COLS);
    if (error) throw error;
    const apoio = await mapasDeApoio();
    return ((data ?? []) as UnidadeRow[]).map((row) =>
      mapUnidade(row, apoio.ferramentas, apoio.funcionarios),
    );
  },

  async atribuir(input: AtribuirUnidadeCommand) {
    const { error } = await supabase.schema("pcm").from("ferramenta_movimentacoes").insert({
      unidade_id: input.unidadeId,
      tipo: "atribuicao",
      funcionario_id: input.funcionarioId,
      created_by: input.userId,
    });
    if (error) throw error;
  },

  async devolver(input: DevolverUnidadeCommand) {
    const { error } = await supabase.schema("pcm").from("ferramenta_movimentacoes").insert({
      unidade_id: input.unidadeId,
      tipo: "devolucao",
      condicao: input.condicao,
      motivo: input.motivo,
      created_by: input.userId,
    });
    if (error) throw error;
  },

  async baixar(input: BaixarUnidadeCommand) {
    const { error } = await supabase.schema("pcm").from("ferramenta_movimentacoes").insert({
      unidade_id: input.unidadeId,
      tipo: "baixa",
      motivo: input.motivo,
      created_by: input.userId,
    });
    if (error) throw error;
  },
};
