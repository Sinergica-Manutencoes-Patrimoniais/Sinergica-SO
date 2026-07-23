import { supabase } from "../../../lib/supabase-client";
import type {
  AssumirConversaCommand,
  AtendimentoGateway,
  ClienteVinculoOpcao,
  DevolverAoZeCommand,
  EnviarMensagemCommand,
  MarcarConversaLidaCommand,
} from "../application/atendimento-gateway";
import type { CanalConversa, ConversaItem, StatusConversa } from "../domain/conversas";
import type { MensagemItem } from "../domain/mensagens";
import type { MensagemRicaInput } from "../domain/mensagens";

interface ConversaRow {
  id: string;
  client_id: string | null;
  contato_nome: string | null;
  canal: CanalConversa;
  status: StatusConversa;
  modo: "auto" | "pausado";
  atribuido_a: string | null;
  handoff_motivo: string | null;
  handoff_em: string | null;
  nao_lidas: number;
  ultima_mensagem_preview: string | null;
  ultima_mensagem_em: string | null;
  ordem_servico_id: string | null;
  tags: string[];
  instance_id: string;
  remote_jid: string;
}

interface MensagemRow {
  id: string;
  conversa_id: string;
  direcao: "entrada" | "saida";
  remetente_tipo: "cliente" | "ze" | "humano" | "agente";
  remetente_id: string | null;
  conteudo: string | null;
  status_entrega: "enviando" | "enviado" | "erro" | null;
  erro_detalhe: string | null;
  created_at: string;
  tipo_conteudo: MensagemItem["tipoConteudo"];
  midia_url: string | null;
  midia_nome: string | null;
  midia_mime: string | null;
  payload: Record<string, unknown>;
}

const CONVERSA_COLS =
  "id,client_id,contato_nome,canal,status,modo,atribuido_a,handoff_motivo,handoff_em,nao_lidas,ultima_mensagem_preview,ultima_mensagem_em,ordem_servico_id,tags,instance_id,remote_jid" as const;
const MENSAGEM_COLS =
  "id,conversa_id,direcao,remetente_tipo,remetente_id,conteudo,status_entrega,erro_detalhe,created_at,tipo_conteudo,midia_url,midia_nome,midia_mime,payload" as const;

function mapConversa(row: ConversaRow, clientesMap: Map<string, string>): ConversaItem {
  return {
    id: row.id,
    clientId: row.client_id,
    clienteNome: row.client_id ? (clientesMap.get(row.client_id) ?? null) : null,
    contatoNome: row.contato_nome,
    canal: row.canal,
    status: row.status,
    modo: row.modo,
    atribuidoA: row.atribuido_a,
    handoffMotivo: row.handoff_motivo,
    handoffEm: row.handoff_em,
    naoLidas: row.nao_lidas,
    ultimaMensagemPreview: row.ultima_mensagem_preview,
    ultimaMensagemEm: row.ultima_mensagem_em,
    ordemServicoId: row.ordem_servico_id,
    tags: row.tags ?? [],
  };
}

function mapMensagem(row: MensagemRow): MensagemItem {
  return {
    id: row.id,
    conversaId: row.conversa_id,
    direcao: row.direcao,
    remetenteTipo: row.remetente_tipo,
    remetenteId: row.remetente_id,
    conteudo: row.conteudo,
    statusEntrega: row.status_entrega,
    erroDetalhe: row.erro_detalhe,
    createdAt: row.created_at,
    tipoConteudo: row.tipo_conteudo,
    midiaUrl: row.midia_url,
    midiaNome: row.midia_nome,
    midiaMime: row.midia_mime,
    payload: row.payload ?? {},
  };
}

async function invocarAcao(
  conversaId: string,
  acao: "enviar" | "assumir" | "devolver" | "acionar_ia",
  texto?: string,
): Promise<{ ok: boolean; mensagemId?: string; erro?: string }> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    mensagemId?: string;
    erro?: string;
  }>("atendimento-whatsapp-envio", { body: { conversaId, acao, texto } });
  if (error) throw error;
  return data ?? { ok: false };
}

export const supabaseAtendimentoAdapter: AtendimentoGateway = {
  async listarConversas(filtro) {
    let query = supabase
      .schema("atendimento")
      .from("conversas")
      .select(CONVERSA_COLS)
      .order("ultima_mensagem_em", { ascending: false, nullsFirst: false });
    if (filtro?.status) query = query.eq("status", filtro.status);
    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as ConversaRow[];
    const clientIds = [
      ...new Set(rows.map((row) => row.client_id).filter((id): id is string => id != null)),
    ];
    const clientesMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientes, error: clientesError } = await supabase
        .schema("pcm")
        .from("clientes")
        .select("id,nome")
        .in("id", clientIds);
      if (clientesError) throw clientesError;
      for (const cliente of clientes ?? [])
        clientesMap.set(cliente.id as string, cliente.nome as string);
    }

    return rows.map((row) => mapConversa(row, clientesMap));
  },

  async listarMensagens(conversaId) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("mensagens")
      .select(MENSAGEM_COLS)
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return Promise.all(
      ((data ?? []) as MensagemRow[]).map(async (row) => {
        const mensagem = mapMensagem(row);
        if (!row.midia_url) return mensagem;
        const { data: signed } = await supabase.storage
          .from("atendimento-midias")
          .createSignedUrl(row.midia_url, 3600);
        return { ...mensagem, midiaUrl: signed?.signedUrl ?? null };
      }),
    );
  },

  async enviarMensagem(input: EnviarMensagemCommand) {
    const resultado = await invocarAcao(input.conversaId, "enviar", input.texto);
    if (!resultado.mensagemId)
      throw new Error(resultado.erro ?? "Não foi possível enviar a mensagem.");
    const { data, error } = await supabase
      .schema("atendimento")
      .from("mensagens")
      .select(MENSAGEM_COLS)
      .eq("id", resultado.mensagemId)
      .single();
    if (error) throw error;
    return mapMensagem(data as MensagemRow);
  },

  async assumirConversa(input: AssumirConversaCommand) {
    const resultado = await invocarAcao(input.conversaId, "assumir");
    if (!resultado.ok) throw new Error("Não foi possível assumir a conversa.");
  },

  async devolverAoZe(input: DevolverAoZeCommand) {
    const resultado = await invocarAcao(input.conversaId, "devolver");
    if (!resultado.ok) throw new Error("Não foi possível devolver a conversa ao Zé.");
  },

  async marcarComoLida(input: MarcarConversaLidaCommand) {
    const { error } = await supabase
      .schema("atendimento")
      .from("conversas")
      .update({ nao_lidas: 0 })
      .eq("id", input.conversaId);
    if (error) throw error;
  },

  async acionarZeAgora(input) {
    const resultado = await invocarAcao(input.conversaId, "acionar_ia");
    if (!resultado.ok) throw new Error("Não foi possível acionar a IA.");
  },

  async listarClientesParaVinculo() {
    const { data, error } = await supabase
      .schema("atendimento")
      .rpc("fn_listar_clientes_para_vinculo");
    if (error) throw error;
    return (data ?? []) as ClienteVinculoOpcao[];
  },

  async vincularCliente(input) {
    const { error } = await supabase.schema("atendimento").rpc("fn_vincular_conversa_cliente", {
      p_conversa_id: input.conversaId,
      p_cliente_id: input.clienteId,
    });
    if (error) throw error;
  },

  async enviarMensagemRica(input: MensagemRicaInput & { conversaId: string }) {
    let midiaPath: string | null = null;
    let midiaUrl: string | null = null;
    if (input.arquivo) {
      midiaPath = `${input.conversaId}/${crypto.randomUUID()}-${input.arquivo.name}`;
      const { error: uploadError } = await supabase.storage
        .from("atendimento-midias")
        .upload(midiaPath, input.arquivo, { contentType: input.arquivo.type });
      if (uploadError) throw uploadError;
      const { data, error: signError } = await supabase.storage
        .from("atendimento-midias")
        .createSignedUrl(midiaPath, 3600);
      if (signError) throw signError;
      midiaUrl = data.signedUrl;
    }
    const { data: resultado, error } = await supabase.functions.invoke<{
      mensagemId?: string;
      erro?: string;
    }>("atendimento-whatsapp-envio", {
      body: {
        conversaId: input.conversaId,
        acao: "enviar_rico",
        tipo: input.tipo,
        texto: input.texto,
        midiaPath,
        midiaUrl,
        midiaNome: input.arquivo?.name,
        midiaMime: input.arquivo?.type,
        templateNome: input.templateNome,
        templateIdioma: input.templateIdioma,
        parametros: input.parametros,
        botoes: input.botoes,
      },
    });
    if (error) throw error;
    if (!resultado?.mensagemId) throw new Error(resultado?.erro ?? "Falha ao enviar conteúdo.");
    const { data, error: selectError } = await supabase
      .schema("atendimento")
      .from("mensagens")
      .select(MENSAGEM_COLS)
      .eq("id", resultado.mensagemId)
      .single();
    if (selectError) throw selectError;
    return mapMensagem(data as MensagemRow);
  },

  async atualizarTags(conversaId, tags) {
    const { error } = await supabase
      .schema("atendimento")
      .from("conversas")
      .update({ tags })
      .eq("id", conversaId);
    if (error) throw error;
  },
};
