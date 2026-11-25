import { supabase } from "../../../lib/supabase-client";
import type {
  CanaisExternosGateway,
  CriarCanalExternoInput,
  CriarWaTemplateInput,
  EditarCanalExternoInput,
} from "../application/canais-externos-gateway";
import type {
  CanalExternoItem,
  StatusConexao,
  TipoCanalExterno,
  WaTemplateItem,
} from "../domain/canais-externos";

interface CanalRow {
  id: string;
  tipo: TipoCanalExterno;
  label: string;
  identificador_externo: string | null;
  waba_id: string | null;
  webhook_registrado: boolean;
  status_conexao: StatusConexao;
  ativo: boolean;
}

interface EstadoCanalMetaResposta {
  estadoConexao?: string;
  saude?: string;
  contaExternaId?: string | null;
  estadoCredencial?: "sem_credencial" | "configurado" | "conectado" | "erro";
  graphVersion?: string;
  indicioToken?: string | null;
  atualizadoEm?: string | null;
  callbackUrl?: string;
  detail?: string;
}

interface TemplateRow {
  id: string;
  canal_id: string;
  nome: string;
  idioma: string;
  categoria: "utility" | "marketing" | "authentication";
  status: "approved" | "pending" | "rejected";
  corpo: string;
  ativo: boolean;
}

const CANAL_COLUNAS =
  "id,tipo,label,identificador_externo,waba_id,webhook_registrado,status_conexao,ativo";
const TEMPLATE_COLUNAS = "id,canal_id,nome,idioma,categoria,status,corpo,ativo";

function mapCanal(row: CanalRow): CanalExternoItem {
  return {
    id: row.id,
    tipo: row.tipo,
    label: row.label,
    identificadorExterno: row.identificador_externo,
    identificadorSecundario: row.waba_id,
    webhookRegistrado: row.webhook_registrado,
    statusConexao: row.status_conexao,
    ativo: row.ativo,
  };
}

function mapTemplate(row: TemplateRow): WaTemplateItem {
  return {
    id: row.id,
    canalId: row.canal_id,
    nome: row.nome,
    idioma: row.idioma,
    categoria: row.categoria,
    status: row.status,
    corpo: row.corpo,
    ativo: row.ativo,
  };
}

export const supabaseCanaisExternosAdapter: CanaisExternosGateway = {
  async listarCanais(tipo: TipoCanalExterno) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("canais_externos")
      .select(CANAL_COLUNAS)
      .eq("tipo", tipo)
      .order("label");
    if (error) throw error;
    return ((data ?? []) as CanalRow[]).map(mapCanal);
  },

  async criarCanal(input: CriarCanalExternoInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("canais_externos")
      .insert({
        tipo: input.tipo,
        label: input.label,
        identificador_externo: input.identificadorExterno,
        waba_id: input.identificadorSecundario,
        created_by: input.userId,
      })
      .select(CANAL_COLUNAS)
      .single();
    if (error) throw error;
    // E02-S16/ADR-1700: criar o canal NÃO o conecta. A verificação só faz sentido depois que a
    // credencial daquele canal está no Vault — quem conecta é a ação `conectar`.
    return mapCanal(data as CanalRow);
  },

  async editarCanal(input: EditarCanalExternoInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("canais_externos")
      .update({
        label: input.label,
        identificador_externo: input.identificadorExterno,
        waba_id: input.identificadorSecundario,
        updated_at: new Date().toISOString(),
        updated_by: input.userId,
      })
      .eq("id", input.id)
      .select(CANAL_COLUNAS)
      .single();
    if (error) throw error;
    return mapCanal(data as CanalRow);
  },

  async desativarCanal(id: string) {
    const { error } = await supabase
      .schema("atendimento")
      .from("canais_externos")
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async conectarCanalMeta(input) {
    // Os segredos saem daqui direto para a Edge Function e nunca passam por tabela nem por estado
    // de componente persistido (ADR-1700).
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean;
      callbackUrl?: string;
      detail?: string;
    }>("atendimento-meta", {
      body: {
        acao: "conectar",
        canalId: input.canalId,
        contaExternaId: input.contaExternaId,
        accessToken: input.accessToken,
        appSecret: input.appSecret,
        verifyToken: input.verifyToken,
      },
    });
    if (error) throw new Error(data?.detail ?? error.message);
    if (!data?.callbackUrl) throw new Error(data?.detail ?? "Não foi possível conectar o canal.");
    return { callbackUrl: data.callbackUrl };
  },

  async obterEstadoMeta(canalId: string) {
    const { data, error } = await supabase.functions.invoke<EstadoCanalMetaResposta>(
      "atendimento-meta",
      { body: { acao: "obter", canalId } },
    );
    if (error) throw new Error(error.message);
    if (!data?.callbackUrl) throw new Error(data?.detail ?? "Não foi possível ler o estado.");
    return {
      estadoConexao: data.estadoConexao ?? "sem_credencial",
      saude: data.saude ?? "desconhecida",
      contaExternaId: data.contaExternaId ?? null,
      estadoCredencial: data.estadoCredencial ?? "sem_credencial",
      graphVersion: data.graphVersion ?? "v22.0",
      indicioToken: data.indicioToken ?? null,
      atualizadoEm: data.atualizadoEm ?? null,
      callbackUrl: data.callbackUrl,
    };
  },

  async verificarCanalMeta(canalId: string) {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; detail?: string }>(
      "atendimento-meta",
      { body: { acao: "verificar", canalId } },
    );
    if (error) throw new Error(data?.detail ?? error.message);
    if (!data?.ok) throw new Error(data?.detail ?? "A Meta recusou a credencial.");
  },

  async listarTemplates() {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("wa_templates")
      .select(TEMPLATE_COLUNAS)
      .order("nome");
    if (error) throw error;
    return ((data ?? []) as TemplateRow[]).map(mapTemplate);
  },

  async criarTemplate(input: CriarWaTemplateInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("wa_templates")
      .insert({
        canal_id: input.canalId,
        nome: input.nome,
        idioma: input.idioma,
        categoria: input.categoria,
        corpo: input.corpo,
        created_by: input.userId,
      })
      .select(TEMPLATE_COLUNAS)
      .single();
    if (error) throw error;
    const criado = mapTemplate(data as TemplateRow);
    const { error: metaError } = await supabase.functions.invoke("atendimento-meta", {
      body: { acao: "criar_template", templateId: criado.id },
    });
    if (metaError) throw new Error(`Template salvo, mas envio à Meta falhou: ${metaError.message}`);
    return criado;
  },

  async editarTemplate(input) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("wa_templates")
      .update({
        canal_id: input.canalId,
        nome: input.nome,
        idioma: input.idioma,
        categoria: input.categoria,
        corpo: input.corpo,
      })
      .eq("id", input.id)
      .select(TEMPLATE_COLUNAS)
      .single();
    if (error) throw error;
    return mapTemplate(data as TemplateRow);
  },
};
