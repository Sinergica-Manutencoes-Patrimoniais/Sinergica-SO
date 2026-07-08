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
  SalvarConfigIaGatewayInput,
  SalvarConfigOperacaoGatewayInput,
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
  modelo_llm: string;
  janela_inicio: string | null;
  janela_fim: string | null;
  janela_dias: number[];
  tool_use_enabled: boolean;
  rag_enabled: boolean;
  vendas_enabled: boolean;
  consulta_pedidos_enabled: boolean;
  limite_diario_mensagens: number | null;
  transferir_apos_n_respostas: number | null;
  palavras_transferencia: string[];
  orcamento_mensal_usd: number | null;
}

// Uma única string literal (sem concatenação) — supabase-js infere o tipo de retorno do
// `.select()` a partir do LITERAL da coluna; concatenar com `+` vira `string` genérico e quebra
// essa inferência (erro TS2352 "GenericStringError").
const PERSONA_COLUNAS =
  "id,nome,tipo,prompt_sistema,base_conhecimento,ativo,modelo_llm,janela_inicio,janela_fim,janela_dias,tool_use_enabled,rag_enabled,vendas_enabled,consulta_pedidos_enabled,limite_diario_mensagens,transferir_apos_n_respostas,palavras_transferencia,orcamento_mensal_usd";

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
    modeloLlm: row.modelo_llm,
    janelaInicio: row.janela_inicio,
    janelaFim: row.janela_fim,
    janelaDias: row.janela_dias,
    toolUseEnabled: row.tool_use_enabled,
    ragEnabled: row.rag_enabled,
    vendasEnabled: row.vendas_enabled,
    consultaPedidosEnabled: row.consulta_pedidos_enabled,
    limiteDiarioMensagens: row.limite_diario_mensagens,
    transferirAposNRespostas: row.transferir_apos_n_respostas,
    palavrasTransferencia: row.palavras_transferencia,
    orcamentoMensalUsd: row.orcamento_mensal_usd,
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
      .select(PERSONA_COLUNAS)
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
      .select(PERSONA_COLUNAS)
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
      .select(PERSONA_COLUNAS)
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

  async salvarConfigIa(input: SalvarConfigIaGatewayInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("personas")
      .update({
        modelo_llm: input.modeloLlm,
        janela_inicio: input.janelaInicio,
        janela_fim: input.janelaFim,
        janela_dias: input.janelaDias,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.personaId)
      .select(PERSONA_COLUNAS)
      .single();
    if (error) throw error;
    return mapPersona(data as PersonaRow);
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

  async salvarConfigOperacao(input: SalvarConfigOperacaoGatewayInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("personas")
      .update({
        tool_use_enabled: input.toolUseEnabled,
        rag_enabled: input.ragEnabled,
        vendas_enabled: input.vendasEnabled,
        consulta_pedidos_enabled: input.consultaPedidosEnabled,
        limite_diario_mensagens: input.limiteDiarioMensagens,
        transferir_apos_n_respostas: input.transferirAposNRespostas,
        palavras_transferencia: input.palavrasTransferencia,
        orcamento_mensal_usd: input.orcamentoMensalUsd,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.personaId)
      .select(PERSONA_COLUNAS)
      .single();
    if (error) throw error;
    return mapPersona(data as PersonaRow);
  },
};
