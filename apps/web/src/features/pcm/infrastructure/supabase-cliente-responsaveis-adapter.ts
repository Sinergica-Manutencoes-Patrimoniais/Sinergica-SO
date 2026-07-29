import { supabase } from "../../../lib/supabase-client";
import type { ClienteResponsaveisGateway } from "../application/cliente-responsaveis-gateway";
import type {
  PreferenciaContato,
  ResponsavelCliente,
  ResponsavelFormData,
} from "../domain/cliente-responsaveis";

interface ResponsavelRow {
  id: string;
  cliente_id: string;
  nome: string;
  papel: string | null;
  email: string | null;
  telefone: string | null;
  preferencia_contato: PreferenciaContato | null;
}

const COLS = "id,cliente_id,nome,papel,email,telefone,preferencia_contato" as const;

function mapResponsavel(row: ResponsavelRow): ResponsavelCliente {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    nome: row.nome,
    papel: row.papel,
    email: row.email,
    telefone: row.telefone,
    preferenciaContato: row.preferencia_contato,
  };
}

export const supabaseClienteResponsaveisAdapter: ClienteResponsaveisGateway = {
  async listarPorCliente(clienteId: string): Promise<ResponsavelCliente[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("cliente_responsaveis")
      .select(COLS)
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .order("nome", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as ResponsavelRow[]).map(mapResponsavel);
  },

  async criar(input: ResponsavelFormData): Promise<ResponsavelCliente> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("cliente_responsaveis")
      .insert({
        cliente_id: input.clienteId,
        nome: input.nome,
        papel: input.papel ?? null,
        email: input.email ?? null,
        telefone: input.telefone ?? null,
        preferencia_contato: input.preferenciaContato ?? null,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    return mapResponsavel(data as ResponsavelRow);
  },

  async editar(id: string, input: ResponsavelFormData): Promise<ResponsavelCliente> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("cliente_responsaveis")
      .update({
        nome: input.nome,
        papel: input.papel ?? null,
        email: input.email ?? null,
        telefone: input.telefone ?? null,
        preferencia_contato: input.preferenciaContato ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) throw error;
    return mapResponsavel(data as ResponsavelRow);
  },

  async remover(id: string): Promise<void> {
    const { error } = await supabase
      .schema("pcm")
      .from("cliente_responsaveis")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};
