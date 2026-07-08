import { supabase } from "../../../lib/supabase-client";
import type {
  ClienteOpcao,
  ConfigGateway,
  CriarTagCommand,
  DesativarTagCommand,
  EditarTagCommand,
  SalvarConfigCanalGatewayInput,
} from "../application/config-gateway";
import type { ConfigCanalItem, ModoZe } from "../domain/config-canal";
import type { TagItem } from "../domain/tags";

interface TagRow {
  id: string;
  nome: string;
  ativo: boolean;
}

interface ConfigZeRow {
  id: string;
  client_id: string;
  modo: ModoZe;
  group_jid: string | null;
  bot_jid: string | null;
}

function mapTag(row: TagRow): TagItem {
  return { id: row.id, nome: row.nome, ativo: row.ativo };
}

function mapConfigCanal(row: ConfigZeRow): ConfigCanalItem {
  return {
    id: row.id,
    clientId: row.client_id,
    modo: row.modo,
    groupJid: row.group_jid,
    botJid: row.bot_jid,
  };
}

export const supabaseConfigAdapter: ConfigGateway = {
  async listarClientes(): Promise<ClienteOpcao[]> {
    const { data, error } = await supabase
      .schema("pcm")
      .from("clientes")
      .select("id,nome")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome");
    if (error) throw error;
    return (data ?? []) as ClienteOpcao[];
  },

  async listarTags() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("tags")
      .select("id,nome,ativo")
      .order("nome");
    if (error) throw error;
    return ((data ?? []) as TagRow[]).map(mapTag);
  },

  async criarTag(input: CriarTagCommand) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("tags")
      .insert({ nome: input.nome, created_by: input.userId })
      .select("id,nome,ativo")
      .single();
    if (error) throw error;
    return mapTag(data as TagRow);
  },

  async editarTag(input: EditarTagCommand) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("tags")
      .update({ nome: input.nome, updated_at: new Date().toISOString(), updated_by: input.userId })
      .eq("id", input.id)
      .select("id,nome,ativo")
      .single();
    if (error) throw error;
    return mapTag(data as TagRow);
  },

  async desativarTag(input: DesativarTagCommand) {
    const { error } = await supabase
      .schema("atendimento")
      .from("tags")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: input.userId })
      .eq("id", input.id);
    if (error) throw error;
  },

  async buscarConfigCanal(clientId: string) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("config_ze")
      .select("id,client_id,modo,group_jid,bot_jid")
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapConfigCanal(data as ConfigZeRow) : null;
  },

  async salvarConfigCanal(input: SalvarConfigCanalGatewayInput) {
    const existente = await this.buscarConfigCanal(input.clientId);
    const query = supabase.schema("atendimento").from("config_ze");
    const { data, error } = existente
      ? await query
          .update({
            modo: input.modo,
            group_jid: input.groupJid,
            bot_jid: input.botJid,
            updated_at: new Date().toISOString(),
            updated_by: input.userId,
          })
          .eq("client_id", input.clientId)
          .select("id,client_id,modo,group_jid,bot_jid")
          .single()
      : await query
          .insert({
            client_id: input.clientId,
            modo: input.modo,
            group_jid: input.groupJid,
            bot_jid: input.botJid,
            created_by: input.userId,
          })
          .select("id,client_id,modo,group_jid,bot_jid")
          .single();
    if (error) throw error;
    return mapConfigCanal(data as ConfigZeRow);
  },
};
