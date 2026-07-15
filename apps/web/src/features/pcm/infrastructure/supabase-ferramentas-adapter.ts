import { supabase } from "../../../lib/supabase-client";
import type {
  DesativarFerramentaCommand,
  EditarFerramentaCommand,
  FerramentaAlocacoesGateway,
  FerramentaCommand,
  FerramentasGateway,
} from "../application/ferramentas-gateway";
import type {
  FerramentaAlocacaoItem,
  FerramentaCategoriaOpcao,
  FerramentaItem,
  FuncionarioFerramentaOpcao,
} from "../domain/ferramentas";

interface FerramentaRow {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  quantidade_total: number;
  quantidade_minima: number;
  ativo: boolean;
  auvo_id: number | null;
  auvo_sync_status: string | null;
  auvo_sync_error: string | null;
  auvo_synced_at: string | null;
  imagem_url: string | null;
  codigo_auvo: string | null;
  valor_unitario: number | null;
  custo_unitario: number | null;
}

interface CategoriaRow {
  id: string;
  nome: string;
  auvo_id: number | null;
}

interface FuncionarioRow {
  id: string;
  nome: string;
  auvo_user_id: number | null;
}

interface AlocacaoRow {
  id: string;
  ferramenta_id: string;
  auvo_user_id: number;
  funcionario_id: string | null;
  quantidade: number;
}

const FERRAMENTA_COLS =
  "id,nome,descricao,categoria_id,quantidade_total,quantidade_minima,ativo,auvo_id,auvo_sync_status,auvo_sync_error,auvo_synced_at,imagem_url,codigo_auvo,valor_unitario,custo_unitario" as const;

function mapFerramenta(row: FerramentaRow, categorias: Map<string, string>): FerramentaItem {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    categoriaId: row.categoria_id,
    categoriaNome: row.categoria_id ? (categorias.get(row.categoria_id) ?? null) : null,
    quantidadeTotal: row.quantidade_total,
    quantidadeMinima: row.quantidade_minima,
    ativo: row.ativo,
    auvoId: row.auvo_id,
    auvoSyncStatus: row.auvo_sync_status,
    auvoSyncError: row.auvo_sync_error,
    auvoSyncedAt: row.auvo_synced_at,
    imagemUrl: row.imagem_url,
    codigoAuvo: row.codigo_auvo,
    valorUnitario: row.valor_unitario,
    custoUnitario: row.custo_unitario,
  };
}

export const supabaseFerramentasAdapter: FerramentasGateway & FerramentaAlocacoesGateway = {
  async listar() {
    const [ferramentas, categorias] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ferramentas")
        .select(FERRAMENTA_COLS)
        .is("deleted_at", null)
        .order("nome", { ascending: true }),
      supabase.schema("pcm").from("produto_categorias").select("id,nome").is("deleted_at", null),
    ]);
    if (ferramentas.error) throw ferramentas.error;
    if (categorias.error) throw categorias.error;
    const categoriasMap = new Map(
      (categorias.data ?? []).map((c) => [c.id as string, c.nome as string]),
    );
    return ((ferramentas.data ?? []) as FerramentaRow[]).map((row) =>
      mapFerramenta(row, categoriasMap),
    );
  },

  async listarFerramentas() {
    return this.listar();
  },

  async listarCategorias(): Promise<FerramentaCategoriaOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("produto_categorias")
      .select("id,nome,auvo_id")
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as CategoriaRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      auvoId: row.auvo_id,
    }));
  },

  async criar(input: FerramentaCommand) {
    const categoria = await buscarCategoria(input.categoriaId ?? null);
    const { data, error } = await supabase
      .schema("pcm")
      .from("ferramentas")
      .insert({
        nome: input.nome,
        descricao: input.descricao,
        categoria_id: categoria?.id ?? null,
        auvo_category_id: categoria?.auvoId ?? null,
        quantidade_total: input.quantidadeTotal,
        quantidade_minima: input.quantidadeMinima,
        valor_unitario: input.valorUnitario ?? null,
        custo_unitario: input.custoUnitario ?? null,
        auvo_sync_status: "pending",
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(FERRAMENTA_COLS)
      .single();
    if (error) throw error;
    return mapFerramenta(
      data as FerramentaRow,
      new Map(categoria ? [[categoria.id, categoria.nome]] : []),
    );
  },

  async editar(input: EditarFerramentaCommand) {
    const categoria = await buscarCategoria(input.categoriaId ?? null);
    const { data, error } = await supabase
      .schema("pcm")
      .from("ferramentas")
      .update({
        nome: input.nome,
        descricao: input.descricao,
        categoria_id: categoria?.id ?? null,
        auvo_category_id: categoria?.auvoId ?? null,
        quantidade_total: input.quantidadeTotal,
        quantidade_minima: input.quantidadeMinima,
        valor_unitario: input.valorUnitario ?? null,
        custo_unitario: input.custoUnitario ?? null,
        auvo_sync_status: "pending",
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(FERRAMENTA_COLS)
      .single();
    if (error) throw error;
    return mapFerramenta(
      data as FerramentaRow,
      new Map(categoria ? [[categoria.id, categoria.nome]] : []),
    );
  },

  async desativar(input: DesativarFerramentaCommand) {
    const agora = new Date().toISOString();
    const { error } = await supabase
      .schema("pcm")
      .from("ferramentas")
      .update({
        ativo: false,
        deleted_at: agora,
        auvo_sync_status: "pending",
        updated_at: agora,
        updated_by: input.userId,
      })
      .eq("id", input.id);
    if (error) throw error;
  },

  async listarFuncionarios(): Promise<FuncionarioFerramentaOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("funcionarios")
      .select("id,nome,auvo_user_id")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as FuncionarioRow[]).map((row) => ({
      id: row.id,
      nome: row.nome,
      auvoUserId: row.auvo_user_id,
    }));
  },

  async listarAlocacoes(): Promise<FerramentaAlocacaoItem[]> {
    const [alocacoes, ferramentas, funcionarios] = await Promise.all([
      supabase
        .schema("pcm")
        .from("ferramenta_alocacoes")
        .select("id,ferramenta_id,auvo_user_id,funcionario_id,quantidade")
        .order("updated_at", { ascending: false }),
      this.listar(),
      this.listarFuncionarios(),
    ]);
    if (alocacoes.error) throw alocacoes.error;
    const ferramentasMap = new Map(ferramentas.map((item) => [item.id, item]));
    const funcionariosMap = new Map(funcionarios.map((item) => [item.auvoUserId, item]));
    return ((alocacoes.data ?? []) as AlocacaoRow[]).map((row) => {
      const ferramenta = ferramentasMap.get(row.ferramenta_id);
      const funcionario = funcionariosMap.get(row.auvo_user_id);
      return {
        id: row.id,
        ferramentaId: row.ferramenta_id,
        ferramentaNome: ferramenta?.nome ?? "Ferramenta removida",
        ferramentaAuvoId: ferramenta?.auvoId ?? null,
        quantidadeTotal: ferramenta?.quantidadeTotal ?? 0,
        funcionarioId: row.funcionario_id,
        funcionarioNome: funcionario?.nome ?? `Auvo ${row.auvo_user_id}`,
        auvoUserId: row.auvo_user_id,
        quantidade: row.quantidade,
      };
    });
  },
};

async function buscarCategoria(
  id: string | null,
): Promise<{ id: string; nome: string; auvoId: number | null } | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .schema("pcm")
    .from("produto_categorias")
    .select("id,nome,auvo_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    nome: data.nome as string,
    auvoId: (data.auvo_id as number | null) ?? null,
  };
}
