import { supabase } from "../../../lib/supabase-client";
import type {
  CriarMarcacaoCommand,
  EditarMarcacaoCommand,
  MarcacoesClienteGateway,
} from "../application/marcacoes-cliente-gateway";
import type { MarcacaoCliente } from "../domain/marcacoes-cliente";

interface MarcacaoRow {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

const MARCACAO_COLS = "id,nome,cor,ativo" as const;

function mapMarcacao(row: MarcacaoRow): MarcacaoCliente {
  return { id: row.id, nome: row.nome, cor: row.cor, ativo: row.ativo };
}

export const supabaseMarcacoesClienteAdapter: MarcacoesClienteGateway = {
  async listar(): Promise<MarcacaoCliente[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("marcacoes_cliente")
      .select(MARCACAO_COLS)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as MarcacaoRow[]).map(mapMarcacao);
  },

  async criar(input: CriarMarcacaoCommand): Promise<MarcacaoCliente> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("marcacoes_cliente")
      .insert({ nome: input.nome, cor: input.cor, created_by: input.userId })
      .select(MARCACAO_COLS)
      .single();
    if (error) throw error;
    return mapMarcacao(data as MarcacaoRow);
  },

  async editar(input: EditarMarcacaoCommand): Promise<MarcacaoCliente> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("marcacoes_cliente")
      .update({
        nome: input.nome,
        cor: input.cor,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(MARCACAO_COLS)
      .single();
    if (error) throw error;
    return mapMarcacao(data as MarcacaoRow);
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase.schema("pcm").from("marcacoes_cliente").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        throw new Error(
          "Esta marcação está em uso por clientes — remova-a deles antes de excluir.",
        );
      }
      throw error;
    }
  },

  async definirMarcacaoCliente(clienteId: string, marcacaoId: string | null, userId: string) {
    const { error } = await supabase
      .schema("pcm")
      .from("clientes")
      .update({ marcacao_id: marcacaoId, updated_by: userId })
      .eq("id", clienteId);
    if (error) throw error;
  },
};
