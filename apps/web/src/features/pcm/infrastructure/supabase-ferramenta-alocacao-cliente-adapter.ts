import { supabase } from "../../../lib/supabase-client";
import type {
  ClienteOpcaoFerramenta,
  FerramentaAlocacaoClienteGateway,
  FerramentaOpcao,
} from "../application/ferramenta-alocacao-cliente-gateway";
import type { AlocacaoFerramentaCliente } from "../domain/ferramenta-alocacao-cliente";

interface AlocacaoRow {
  id: string;
  ferramenta_id: string;
  cliente_id: string;
  alocada_em: string;
  devolvida_em: string | null;
}

interface FerramentaRow {
  id: string;
  nome: string;
  categoria_id: string | null;
}

const COLS = "id,ferramenta_id,cliente_id,alocada_em,devolvida_em" as const;

async function mapearNomes(
  ferramentaIds: string[],
  clienteIds: string[],
): Promise<{
  ferramentas: Map<
    string,
    { nome: string; categoriaId: string | null; categoriaNome: string | null }
  >;
  clientes: Map<string, string>;
}> {
  const [
    { data: ferramentasData, error: ferramentasError },
    { data: clientesData, error: clientesError },
  ] = await Promise.all([
    ferramentaIds.length > 0
      ? supabase
          .schema("pcm")
          .from("ferramentas")
          .select("id,nome,categoria_id")
          .in("id", ferramentaIds)
      : Promise.resolve({ data: [], error: null }),
    clienteIds.length > 0
      ? supabase.schema("pcm").from("clientes").select("id,nome").in("id", clienteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ferramentasError) throw ferramentasError;
  if (clientesError) throw clientesError;
  const categoriaIds = [
    ...new Set(
      ((ferramentasData ?? []) as FerramentaRow[])
        .map((ferramenta) => ferramenta.categoria_id)
        .filter((categoriaId): categoriaId is string => categoriaId !== null),
    ),
  ];
  const { data: categoriasData, error: categoriasError } = categoriaIds.length
    ? await supabase
        .schema("pcm")
        .from("produto_categorias")
        .select("id,nome")
        .in("id", categoriaIds)
    : { data: [], error: null };
  if (categoriasError) throw categoriasError;
  const categorias = new Map(
    (categoriasData ?? []).map((categoria) => [categoria.id as string, categoria.nome as string]),
  );
  return {
    ferramentas: new Map(
      ((ferramentasData ?? []) as FerramentaRow[]).map((ferramenta) => [
        ferramenta.id,
        {
          nome: ferramenta.nome,
          categoriaId: ferramenta.categoria_id,
          categoriaNome: ferramenta.categoria_id
            ? (categorias.get(ferramenta.categoria_id) ?? null)
            : null,
        },
      ]),
    ),
    clientes: new Map((clientesData ?? []).map((c) => [c.id as string, c.nome as string])),
  };
}

function mapAlocacao(
  row: AlocacaoRow,
  ferramentas: Map<
    string,
    { nome: string; categoriaId: string | null; categoriaNome: string | null }
  >,
  clientes: Map<string, string>,
): AlocacaoFerramentaCliente {
  return {
    id: row.id,
    ferramentaId: row.ferramenta_id,
    ferramentaNome: ferramentas.get(row.ferramenta_id)?.nome ?? "Ferramenta",
    categoriaId: ferramentas.get(row.ferramenta_id)?.categoriaId ?? null,
    categoriaNome: ferramentas.get(row.ferramenta_id)?.categoriaNome ?? null,
    clienteId: row.cliente_id,
    clienteNome: clientes.get(row.cliente_id) ?? "Cliente",
    alocadaEm: row.alocada_em,
    devolvidaEm: row.devolvida_em,
  };
}

export const supabaseFerramentaAlocacaoClienteAdapter: FerramentaAlocacaoClienteGateway = {
  async listarPorCliente(clienteId: string): Promise<AlocacaoFerramentaCliente[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("ferramenta_alocacoes_cliente")
      .select(COLS)
      .eq("cliente_id", clienteId)
      .order("alocada_em", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as AlocacaoRow[];
    const { ferramentas, clientes } = await mapearNomes(
      [...new Set(rows.map((r) => r.ferramenta_id))],
      [clienteId],
    );
    return rows.map((row) => mapAlocacao(row, ferramentas, clientes));
  },

  async listarAtivas(): Promise<AlocacaoFerramentaCliente[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("ferramenta_alocacoes_cliente")
      .select(COLS)
      .is("devolvida_em", null)
      .order("alocada_em", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as AlocacaoRow[];
    const { ferramentas, clientes } = await mapearNomes(
      [...new Set(rows.map((r) => r.ferramenta_id))],
      [...new Set(rows.map((r) => r.cliente_id))],
    );
    return rows.map((row) => mapAlocacao(row, ferramentas, clientes));
  },

  async listarClientesAtivos(): Promise<ClienteOpcaoFerramenta[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select("id,nome")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((c) => ({ id: c.id as string, nome: c.nome as string }));
  },

  async listarDisponiveis(): Promise<FerramentaOpcao[]> {
    const [{ data: ferramentas, error: ferramentasError }, { data: ativas, error: ativasError }] =
      await Promise.all([
        supabase
          .schema("pcm")
          .from("ferramentas")
          .select("id,nome")
          .eq("ativo", true)
          .is("deleted_at", null)
          .order("nome", { ascending: true }),
        supabase
          .schema("pcm")
          .from("ferramenta_alocacoes_cliente")
          .select("ferramenta_id")
          .is("devolvida_em", null),
      ]);
    if (ferramentasError) throw ferramentasError;
    if (ativasError) throw ativasError;
    const alocadas = new Set((ativas ?? []).map((a) => a.ferramenta_id as string));
    return (ferramentas ?? [])
      .filter((f) => !alocadas.has(f.id as string))
      .map((f) => ({ id: f.id as string, nome: f.nome as string }));
  },

  async alocar(
    ferramentaId: string,
    clienteId: string,
    userId: string,
  ): Promise<AlocacaoFerramentaCliente> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("ferramenta_alocacoes_cliente")
      .insert({
        ferramenta_id: ferramentaId,
        cliente_id: clienteId,
        created_by: userId,
        updated_by: userId,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    const { ferramentas, clientes } = await mapearNomes([ferramentaId], [clienteId]);
    return mapAlocacao(data as AlocacaoRow, ferramentas, clientes);
  },

  async devolver(alocacaoId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .schema("pcm")
      .from("ferramenta_alocacoes_cliente")
      .update({ devolvida_em: new Date().toISOString(), updated_by: userId })
      .eq("id", alocacaoId);
    if (error) throw error;
  },
};
