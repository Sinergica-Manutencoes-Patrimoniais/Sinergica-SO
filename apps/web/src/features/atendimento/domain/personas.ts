export type TipoPersona = "chamados" | "comercial";

export interface PersonaItem {
  id: string;
  nome: string;
  tipo: TipoPersona;
  promptSistema: string;
  baseConhecimento: string | null;
  ativo: boolean;
}

export interface PersonaFormData {
  nome: string;
  tipo: TipoPersona;
  promptSistema: string;
  baseConhecimento: string;
}

export interface PersonaValidado {
  nome: string;
  tipo: TipoPersona;
  promptSistema: string;
  baseConhecimento: string | null;
}

export function validarPersona(input: PersonaFormData): PersonaValidado {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome da persona é obrigatório.");
  const promptSistema = input.promptSistema.trim();
  if (!promptSistema) throw new Error("Prompt de sistema é obrigatório.");
  const baseConhecimento = input.baseConhecimento.trim();
  return { nome, tipo: input.tipo, promptSistema, baseConhecimento: baseConhecimento || null };
}

export function labelTipoPersona(tipo: TipoPersona): string {
  return tipo === "chamados" ? "Chamados (PCM)" : "Comercial";
}
