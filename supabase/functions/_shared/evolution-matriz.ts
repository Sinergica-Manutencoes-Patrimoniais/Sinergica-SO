// _shared/evolution-matriz.ts — E02-S35 (ADR-1686).
// ESPELHO de apps/web/src/features/atendimento/domain/evolution-compatibilidade.ts — Deno não
// importa do bundle Vite, então a mesma lista precisa existir, IDÊNTICA, nas duas pontas. Um teste
// de paridade (abaixo) falha se um lado mudar sem o outro.

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
  {
    // Provada pelo fluxo LEGADO (`atendimento-evolution`) já em produção contra este mesmo
    // servidor: cria instância, QR, estado de conexão, webhook com headers e eventos
    // (MESSAGES_UPSERT/MESSAGES_UPDATE já chegam por aqui hoje), envio de texto e status de
    // entrega — as 7 capacidades, achado ao migrar o canal real pra E02-S36 (não smoke isolado).
    versao: "2.3.7",
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
