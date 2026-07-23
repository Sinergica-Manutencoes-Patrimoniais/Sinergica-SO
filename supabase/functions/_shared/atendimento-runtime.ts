export type TipoPersonaAtendimento = "chamados" | "comercial";

export interface VinculoInstanciaRuntime {
  personaId: string;
  personaTipo: TipoPersonaAtendimento;
}

export type RotaAtendimento =
  | { tipo: TipoPersonaAtendimento; personaId: string | null; origem: "instancia" | "legado" }
  | null;

export function resolverRotaAtendimento(input: {
  vinculo: VinculoInstanciaRuntime | null;
  temConfigZe: boolean;
}): RotaAtendimento {
  if (input.vinculo) {
    return {
      tipo: input.vinculo.personaTipo,
      personaId: input.vinculo.personaId,
      origem: "instancia",
    };
  }
  return input.temConfigZe ? { tipo: "chamados", personaId: null, origem: "legado" } : null;
}

export function avaliarMotivoHandoff(input: {
  contexto: string;
  palavrasTransferencia: string[];
  respostasAgente: number;
  transferirAposNRespostas: number | null;
  respostasAgenteHoje: number;
  limiteDiarioMensagens: number | null;
  clienteObrigatorioAusente?: boolean;
}): string | null {
  if (input.clienteObrigatorioAusente) return "Cliente PCM não vinculado";

  const contexto = input.contexto.toLocaleLowerCase("pt-BR");
  const palavra = input.palavrasTransferencia
    .map((item) => item.trim())
    .filter(Boolean)
    .find((item) => contexto.includes(item.toLocaleLowerCase("pt-BR")));
  if (palavra) return `Palavra de transferência: ${palavra}`;

  if (
    input.transferirAposNRespostas !== null &&
    input.respostasAgente >= input.transferirAposNRespostas
  ) {
    return `Limite de ${input.transferirAposNRespostas} respostas atingido`;
  }

  if (
    input.limiteDiarioMensagens !== null &&
    input.respostasAgenteHoje >= input.limiteDiarioMensagens
  ) {
    return `Limite diário de ${input.limiteDiarioMensagens} respostas atingido`;
  }
  return null;
}

export function comporPromptPersona(
  promptSistema: string,
  baseConhecimento: string | null,
  conhecimentoRag: string,
): string {
  return [promptSistema, baseConhecimento, conhecimentoRag]
    .map((parte) => parte?.trim())
    .filter((parte): parte is string => Boolean(parte))
    .join("\n\n");
}
