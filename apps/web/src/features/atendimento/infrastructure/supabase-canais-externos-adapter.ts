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
  verify_token: string | null;
  webhook_registrado: boolean;
  status_conexao: StatusConexao;
  ativo: boolean;
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
  "id,tipo,label,identificador_externo,waba_id,verify_token,webhook_registrado,status_conexao,ativo";
const TEMPLATE_COLUNAS = "id,canal_id,nome,idioma,categoria,status,corpo,ativo";

function mapCanal(row: CanalRow): CanalExternoItem {
  return {
    id: row.id,
    tipo: row.tipo,
    label: row.label,
    identificadorExterno: row.identificador_externo,
    identificadorSecundario: row.waba_id,
    verifyToken: row.verify_token,
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
        verify_token: input.verifyToken,
        created_by: input.userId,
      })
      .select(CANAL_COLUNAS)
      .single();
    if (error) throw error;
    const criado = mapCanal(data as CanalRow);
    if (input.tipo !== "evolution") {
      const { error: verifyError } = await supabase.functions.invoke("atendimento-meta", {
        body: { acao: "verificar", canalId: criado.id },
      });
      if (verifyError)
        throw new Error(`Canal salvo, mas a conexão Meta falhou: ${verifyError.message}`);
      const { data: atualizado, error: reloadError } = await supabase
        .schema("atendimento")
        .from("canais_externos")
        .select(CANAL_COLUNAS)
        .eq("id", criado.id)
        .single();
      if (reloadError) throw reloadError;
      return mapCanal(atualizado as CanalRow);
    }
    return criado;
  },

  async editarCanal(input: EditarCanalExternoInput) {
    const { data, error } = await supabase
      .schema("atendimento")
      .from("canais_externos")
      .update({
        label: input.label,
        identificador_externo: input.identificadorExterno,
        waba_id: input.identificadorSecundario,
        verify_token: input.verifyToken,
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
