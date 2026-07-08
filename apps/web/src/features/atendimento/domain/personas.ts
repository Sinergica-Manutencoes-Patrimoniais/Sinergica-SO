export type TipoPersona = "chamados" | "comercial";

export interface PersonaItem {
  id: string;
  nome: string;
  tipo: TipoPersona;
  promptSistema: string;
  baseConhecimento: string | null;
  ativo: boolean;
  /** Config IA (E02-S13) — modelo/janela de atendimento por persona. */
  modeloLlm: string;
  janelaInicio: string | null;
  janelaFim: string | null;
  janelaDias: number[];
  /** Config Operação (E02-S14) — motores + regras de atendimento. */
  toolUseEnabled: boolean;
  ragEnabled: boolean;
  vendasEnabled: boolean;
  consultaPedidosEnabled: boolean;
  limiteDiarioMensagens: number | null;
  transferirAposNRespostas: number | null;
  palavrasTransferencia: string[];
  orcamentoMensalUsd: number | null;
}

export interface ConfigIaFormData {
  modeloLlm: string;
  janelaInicio: string;
  janelaFim: string;
  janelaDias: number[];
}

export interface ConfigIaValidado {
  modeloLlm: string;
  janelaInicio: string | null;
  janelaFim: string | null;
  janelaDias: number[];
}

export function validarConfigIa(input: ConfigIaFormData): ConfigIaValidado {
  const modeloLlm = input.modeloLlm.trim();
  if (!modeloLlm) throw new Error("Modelo LLM é obrigatório.");
  const janelaInicio = input.janelaInicio.trim();
  const janelaFim = input.janelaFim.trim();
  if ((janelaInicio && !janelaFim) || (!janelaInicio && janelaFim)) {
    throw new Error("Informe início e fim da janela juntos, ou deixe os dois em branco.");
  }
  if (input.janelaDias.length === 0) {
    throw new Error("Selecione ao menos um dia da semana.");
  }
  return {
    modeloLlm,
    janelaInicio: janelaInicio || null,
    janelaFim: janelaFim || null,
    janelaDias: input.janelaDias,
  };
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
