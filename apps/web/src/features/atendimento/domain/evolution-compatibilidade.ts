/**
 * E02-S35 — Matriz de compatibilidade do servidor Evolution (ADR-1686).
 *
 * Versao fora da matriz falha fechada, mesmo que os endpoints pareçam existir — nunca se infere
 * suporte por nome do produto ou por sondagem de rota. A mesma lista precisa existir, IDÊNTICA, em
 * `supabase/functions/_shared/evolution-matriz.ts` (Deno não importa deste bundle Vite); um teste de
 * paridade compara as duas.
 */

export type Capacidade =
  | "instanceCreate"
  | "qr"
  | "connectionState"
  | "webhookHeaders"
  | "webhookEvents"
  | "sendText"
  | "deliveryStatus";

export const CAPACIDADES_OBRIGATORIAS: readonly Capacidade[] = [
  "instanceCreate",
  "qr",
  "connectionState",
  "webhookHeaders",
  "webhookEvents",
  "sendText",
  "deliveryStatus",
];

export interface EntradaDaMatriz {
  versao: string;
  capacidades: readonly Capacidade[];
}

export type ResultadoDeCompatibilidade =
  | { compativel: true; versao: string }
  | { compativel: false; motivo: string };

/**
 * Versões comprovadas por smoke de contrato (ADR-1686). Versão nova entra aqui só depois de provar
 * as 7 capacidades obrigatórias contra um servidor real — nunca por suposição de changelog.
 */
export const MATRIZ_DE_COMPATIBILIDADE: readonly EntradaDaMatriz[] = [
  {
    versao: "2.1.1",
    capacidades: [
      "instanceCreate",
      "qr",
      "connectionState",
      "webhookHeaders",
      "webhookEvents",
      "sendText",
      "deliveryStatus",
    ],
  },
];

export function avaliarCompatibilidade(
  matriz: readonly EntradaDaMatriz[],
  versaoInstalada: string,
): ResultadoDeCompatibilidade {
  const entrada = matriz.find((item) => item.versao === versaoInstalada);
  if (entrada === undefined) {
    return {
      compativel: false,
      motivo: `Versao ${versaoInstalada} nao esta na matriz de compatibilidade.`,
    };
  }

  const faltando = CAPACIDADES_OBRIGATORIAS.filter(
    (capacidade) => !entrada.capacidades.includes(capacidade),
  );
  if (faltando.length > 0) {
    return {
      compativel: false,
      motivo: `Versao ${versaoInstalada} nao prova: ${faltando.join(", ")}.`,
    };
  }

  return { compativel: true, versao: versaoInstalada };
}
