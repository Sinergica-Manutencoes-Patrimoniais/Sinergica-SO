// E02-S16/ADR-1700: `verifyToken` saiu daqui. Segredo de webhook não trafega pelo browser nem
// mora em `canais_externos` — vai para o Vault pela ação `conectar` de `atendimento-meta`.
export type TipoCanalExterno = "meta_wa" | "instagram" | "messenger" | "evolution";
export type StatusConexao = "conectado" | "desconectado" | "erro";

export interface CanalExternoItem {
  id: string;
  tipo: TipoCanalExterno;
  label: string;
  identificadorExterno: string | null;
  identificadorSecundario: string | null;
  webhookRegistrado: boolean;
  statusConexao: StatusConexao;
  ativo: boolean;
}

export interface CanalExternoFormData {
  tipo: TipoCanalExterno;
  label: string;
  identificadorExterno: string;
  identificadorSecundario: string;
}

export interface CanalExternoValidado {
  tipo: TipoCanalExterno;
  label: string;
  identificadorExterno: string | null;
  identificadorSecundario: string | null;
}

export function validarCanalExterno(input: CanalExternoFormData): CanalExternoValidado {
  const label = input.label.trim();
  if (!label) throw new Error("Nome do canal é obrigatório.");
  return {
    tipo: input.tipo,
    label,
    identificadorExterno: input.identificadorExterno.trim() || null,
    identificadorSecundario: input.identificadorSecundario.trim() || null,
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

// ── Conexão Meta (E02-S16/ADR-1700) ────────────────────────────────────────────
// Os três segredos vão para o Vault pela Edge Function; esta validação existe para o operador
// receber a recusa na hora, não depois de um 422 da Meta.

export interface ConexaoMetaFormData {
  canalId: string;
  contaExternaId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
}

export type ConexaoMetaValidada = ConexaoMetaFormData;

export function validarConexaoMeta(input: ConexaoMetaFormData): ConexaoMetaValidada {
  if (!input.canalId) throw new Error("Selecione a conexão antes de conectar.");
  const contaExternaId = input.contaExternaId.trim();
  if (!/^[0-9]{1,64}$/.test(contaExternaId)) {
    throw new Error("O ID da conta da Meta é só número — copie da Meta, sem @ e sem espaços.");
  }
  const accessToken = input.accessToken.trim();
  if (accessToken.length < 20) throw new Error("Cole o token de acesso completo.");
  const appSecret = input.appSecret.trim();
  if (appSecret.length < 10) throw new Error("Cole o app secret do aplicativo da Meta.");
  const verifyToken = input.verifyToken.trim();
  if (verifyToken.length < 10) {
    throw new Error("Escolha um token de verificação com pelo menos 10 caracteres.");
  }
  return { canalId: input.canalId, contaExternaId, accessToken, appSecret, verifyToken };
}

/** Estado sanitizado que a tela recebe de volta — nunca segredo, nunca referência de cofre. */
export interface EstadoCanalMeta {
  estadoConexao: string;
  saude: string;
  contaExternaId: string | null;
  estadoCredencial: "sem_credencial" | "configurado" | "conectado" | "erro";
  graphVersion: string;
  indicioToken: string | null;
  atualizadoEm: string | null;
  callbackUrl: string;
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
