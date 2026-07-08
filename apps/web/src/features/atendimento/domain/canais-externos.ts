export type TipoCanalExterno = "meta_wa" | "instagram" | "messenger" | "evolution";
export type StatusConexao = "conectado" | "desconectado" | "erro";

export interface CanalExternoItem {
  id: string;
  tipo: TipoCanalExterno;
  label: string;
  identificadorExterno: string | null;
  identificadorSecundario: string | null;
  verifyToken: string | null;
  webhookRegistrado: boolean;
  statusConexao: StatusConexao;
  ativo: boolean;
}

export interface CanalExternoFormData {
  tipo: TipoCanalExterno;
  label: string;
  identificadorExterno: string;
  identificadorSecundario: string;
  verifyToken: string;
}

export interface CanalExternoValidado {
  tipo: TipoCanalExterno;
  label: string;
  identificadorExterno: string | null;
  identificadorSecundario: string | null;
  verifyToken: string | null;
}

export function validarCanalExterno(input: CanalExternoFormData): CanalExternoValidado {
  const label = input.label.trim();
  if (!label) throw new Error("Nome do canal é obrigatório.");
  return {
    tipo: input.tipo,
    label,
    identificadorExterno: input.identificadorExterno.trim() || null,
    identificadorSecundario: input.identificadorSecundario.trim() || null,
    verifyToken: input.verifyToken.trim() || null,
  };
}

export function labelTipoCanal(tipo: TipoCanalExterno): string {
  if (tipo === "meta_wa") return "Meta WA";
  if (tipo === "instagram") return "Instagram";
  if (tipo === "messenger") return "Messenger";
  return "Evolution";
}

export interface WaTemplateItem {
  id: string;
  canalId: string;
  nome: string;
  idioma: string;
  categoria: "utility" | "marketing" | "authentication";
  status: "approved" | "pending" | "rejected";
  corpo: string;
  ativo: boolean;
}

export interface WaTemplateFormData {
  canalId: string;
  nome: string;
  idioma: string;
  categoria: "utility" | "marketing" | "authentication";
  corpo: string;
}

export interface WaTemplateValidado {
  canalId: string;
  nome: string;
  idioma: string;
  categoria: "utility" | "marketing" | "authentication";
  corpo: string;
}

export function validarWaTemplate(input: WaTemplateFormData): WaTemplateValidado {
  if (!input.canalId) throw new Error("Selecione a conexão WhatsApp.");
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do template é obrigatório.");
  const corpo = input.corpo.trim();
  if (!corpo) throw new Error("Corpo do template é obrigatório.");
  return {
    canalId: input.canalId,
    nome,
    idioma: input.idioma.trim() || "pt_BR",
    categoria: input.categoria,
    corpo,
  };
}
