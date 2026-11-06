import { z } from "zod";
import type {
  CriarRegraContratualCommand,
  CriarRegraContratualGateway,
} from "./calendario-contratual-gateway";

const data = z.string().refine((valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000")) return false;
  const instante = Date.parse(`${valor}T00:00:00.000Z`);
  return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 10) === valor;
}, "Data inválida.");
const inteiro = z.number().int().nonnegative().max(2147483647);
const fusoIana = z
  .string()
  .trim()
  .min(1)
  .refine((valor) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: valor });
      return true;
    } catch {
      return false;
    }
  }, "Fuso horário inválido.");
const schema = z
  .object({
    requestId: z.string().uuid(),
    expectedRevision: z.literal(0),
    clienteId: z.string().uuid(),
    serieId: z.string().uuid(),
    regraId: z.string().uuid(),
    contratoId: z.string().uuid(),
    ancoraSemana: data.refine(
      (valor) => new Date(`${valor}T00:00:00.000Z`).getUTCDay() === 1,
      "A âncora deve ser segunda-feira.",
    ),
    diaSemana: inteiro.min(1).max(7),
    intervaloSemanas: inteiro.min(1),
    horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
    duracaoMinutos: inteiro.min(1),
    deslocamentoMinutos: inteiro,
    fuso: fusoIana,
    vigenciaInicio: data,
    vigenciaFim: data.nullable(),
  })
  .strict()
  .refine((v) => v.vigenciaFim === null || v.vigenciaFim >= v.vigenciaInicio, "Vigência inválida.");

export function validarCriacaoRegraContratual(
  comando: CriarRegraContratualCommand,
): CriarRegraContratualCommand {
  return schema.parse(comando);
}
export async function criarRegraContratual(
  gateway: CriarRegraContratualGateway,
  comando: CriarRegraContratualCommand,
) {
  const pedido = validarCriacaoRegraContratual(comando);
  const recibo = await gateway.criarRegra(pedido);
  if (
    recibo.requestId.toLowerCase() !== pedido.requestId.toLowerCase() ||
    recibo.aggregateId.toLowerCase() !== pedido.serieId.toLowerCase() ||
    recibo.revision !== pedido.expectedRevision + 1 ||
    recibo.state !== "registrada" ||
    recibo.linkedIds.clienteId?.toLowerCase() !== pedido.clienteId.toLowerCase() ||
    recibo.linkedIds.contratoId?.toLowerCase() !== pedido.contratoId.toLowerCase() ||
    recibo.linkedIds.regraId?.toLowerCase() !== pedido.regraId.toLowerCase()
  ) {
    throw new Error("Resposta da regra contratual não corresponde ao pedido.");
  }
  return recibo;
}
