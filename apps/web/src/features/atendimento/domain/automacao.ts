export interface IgAutomationItem {
  id: string;
  canalId: string | null;
  nome: string;
  palavrasGatilho: string[];
  respostaDm: string;
  ativo: boolean;
}

export interface IgAutomationFormData {
  canalId: string;
  nome: string;
  palavrasGatilho: string[];
  respostaDm: string;
}

export interface IgAutomationValidado {
  canalId: string | null;
  nome: string;
  palavrasGatilho: string[];
  respostaDm: string;
}

export function validarIgAutomation(input: IgAutomationFormData): IgAutomationValidado {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome da regra é obrigatório.");
  if (input.palavrasGatilho.length === 0) throw new Error("Informe ao menos uma palavra-gatilho.");
  const respostaDm = input.respostaDm.trim();
  if (!respostaDm) throw new Error("Mensagem do Direct é obrigatória.");
  return {
    canalId: input.canalId || null,
    nome,
    palavrasGatilho: input.palavrasGatilho.map((p) => p.trim()).filter(Boolean),
    respostaDm,
  };
}

export type CanalOptOut = "whatsapp" | "instagram" | "messenger" | "todos";

export interface OptOutItem {
  id: string;
  contatoId: string;
  contatoNome: string | null;
  canal: CanalOptOut;
  motivo: string | null;
}

export interface OptOutFormData {
  contatoId: string;
  canal: CanalOptOut;
  motivo: string;
}

export function validarOptOut(input: OptOutFormData) {
  const contatoId = input.contatoId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(contatoId)) {
    throw new Error("Informe um ID de contato válido.");
  }
  return { contatoId, canal: input.canal, motivo: input.motivo.trim() || null };
}
