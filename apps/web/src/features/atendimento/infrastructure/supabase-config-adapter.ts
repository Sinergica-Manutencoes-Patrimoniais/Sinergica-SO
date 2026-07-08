import { supabase } from "../../../lib/supabase-client";
import type {
  ClienteOpcao,
  ConfigGateway,
  CriarInstanciaAgenteCommand,
  CriarPersonaGatewayInput,
  CriarTagCommand,
  DesativarInstanciaAgenteCommand,
  DesativarPersonaCommand,
  DesativarTagCommand,
  EditarPersonaGatewayInput,
  EditarTagCommand,
  SalvarConfigCanalGatewayInput,
} from "../application/config-gateway";
import type { ConfigCanalItem, ModoZe } from "../domain/config-canal";
import type { InstanciaAgenteItem } from "../domain/instancias-agente";
import type { PersonaItem, TipoPersona } from "../domain/personas";
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

interface PersonaRow {
  id: string;
  nome: string;
  tipo: TipoPersona;
  prompt_sistema: string;
  base_conhecimento: string | null;
  ativo: boolean;
}

interface InstanciaAgenteRow {
  id: string;
  instance_id: string;
  persona_id: string;
  ativo: boolean;
  personas: { nome: string } | null;
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

function mapPersona(row: PersonaRow): PersonaItem {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    promptSistema: row.prompt_sistema,
    baseConhecimento: row.base_conhecimento,
    ativo: row.ativo,
  };
}

function mapInstanciaAgente(row: InstanciaAgenteRow): InstanciaAgenteItem {
  return {
    id: row.id,
    instanceId: row.instance_id,
    personaId: row.persona_id,
    personaNome: row.personas?.nome ?? "—",
    ativo: row.ativo,
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

  async listarPersonas() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("personas")
      .select("id,nome,tipo,prompt_sistema,base_conhecimento,ativo")
      .order("nome");
    if (error) throw error;
    return ((data ?? []) as PersonaRow[]).map(mapPersona);
  },

  async criarPersona(input: CriarPersonaGatewayInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("personas")
      .insert({
        nome: input.nome,
        tipo: input.tipo,
        prompt_sistema: input.promptSistema,
        base_conhecimento: input.baseConhecimento,
        created_by: input.userId,
      })
      .select("id,nome,tipo,prompt_sistema,base_conhecimento,ativo")
      .single();
    if (error) throw error;
    return mapPersona(data as PersonaRow);
  },

  async editarPersona(input: EditarPersonaGatewayInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("personas")
      .update({
        nome: input.nome,
        tipo: input.tipo,
        prompt_sistema: input.promptSistema,
        base_conhecimento: input.baseConhecimento,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select("id,nome,tipo,prompt_sistema,base_conhecimento,ativo")
      .single();
    if (error) throw error;
    return mapPersona(data as PersonaRow);
  },

  async desativarPersona(input: DesativarPersonaCommand) {
    const { error } = await supabase
      .schema("atendimento")
      .from("personas")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: input.userId })
      .eq("id", input.id);
    if (error) throw error;
  },

  async listarInstanciasAgente() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("instancias_agente")
      .select("id,instance_id,persona_id,ativo,personas(nome)")
      .order("instance_id");
    if (error) throw error;
    return ((data ?? []) as unknown as InstanciaAgenteRow[]).map(mapInstanciaAgente);
  },

  async criarInstanciaAgente(input: CriarInstanciaAgenteCommand) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("instancias_agente")
      .insert({
        instance_id: input.instanceId,
        persona_id: input.personaId,
        created_by: input.userId,
      })
      .select("id,instance_id,persona_id,ativo,personas(nome)")
      .single();
    if (error) throw error;
    return mapInstanciaAgente(data as unknown as InstanciaAgenteRow);
  },

  async desativarInstanciaAgente(input: DesativarInstanciaAgenteCommand) {
    const { error } = await supabase
      .schema("atendimento")
      .from("instancias_agente")
      .update({ ativo: false, updated_at: new Date().toISOString(), updated_by: input.userId })
      .eq("id", input.id);
    if (error) throw error;
  },
};
