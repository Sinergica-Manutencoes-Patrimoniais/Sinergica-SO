export type PedidoBaseCapacidade = { clienteId: string; semanaInicio: string; semanaFim: string };
export type FonteCapacidade =
  | "disponibilidade"
  | "reservasAusencias"
  | "demandas"
  | "visitas"
  | "vinculacoes"
  | "qualificacoes";
export type CoberturaCapacidade = Record<FonteCapacidade, boolean>;
export interface CapacidadeAgendaGateway {
  consultar(
    pedido: PedidoBaseCapacidade,
    signal?: AbortSignal,
  ): Promise<PedidoBaseCapacidade & { cobertura: CoberturaCapacidade }>;
}
const fontes: readonly FonteCapacidade[] = [
  "disponibilidade",
  "reservasAusencias",
  "demandas",
  "visitas",
  "vinculacoes",
  "qualificacoes",
];

/** Confere somente contexto e cobertura declarada; não calcula nem comprova disponibilidade. */
export async function conferirBaseCapacidade(
  gateway: CapacidadeAgendaGateway,
  pedido: PedidoBaseCapacidade,
  signal?: AbortSignal,
): Promise<
  | { situacao: "incompleta"; fontesPendentes: FonteCapacidade[] }
  | { situacao: "cobertura_informada" }
> {
  const dataCivil = (texto: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || texto.startsWith("0000")) return Number.NaN;
    const data = new Date(`${texto}T00:00:00.000Z`);
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === texto
      ? data.getTime()
      : Number.NaN;
  };
  const inicio = dataCivil(pedido.semanaInicio);
  const fim = dataCivil(pedido.semanaFim);
  if (
    !pedido.clienteId.trim() ||
    !Number.isFinite(inicio) ||
    !Number.isFinite(fim) ||
    new Date(inicio).getUTCDay() !== 1 ||
    fim - inicio !== 6 * 86_400_000
  )
    throw new Error("Semana ou Cliente inválido.");
  const esperado = { ...pedido };
  const resposta = await gateway.consultar({ ...esperado }, signal);
  if (signal?.aborted) throw new DOMException("Consulta cancelada.", "AbortError");
  if (
    resposta.clienteId !== esperado.clienteId ||
    resposta.semanaInicio !== esperado.semanaInicio ||
    resposta.semanaFim !== esperado.semanaFim
  )
    throw new Error("Contexto da capacidade divergente.");
  const pendentes = fontes.filter((fonte) => resposta.cobertura?.[fonte] !== true);
  return pendentes.length
    ? { situacao: "incompleta", fontesPendentes: pendentes }
    : { situacao: "cobertura_informada" };
}
import {
  calcularDisponibilidade,
  type ParametrosDisponibilidade,
} from "../domain/capacidade-agenda";
import { chaveOrigem } from "../domain/capacidade-por-tecnico";

export interface ResumoCapacidadeGateway {
  consultar(
    pedido: PedidoBaseCapacidade,
    signal?: AbortSignal,
  ): Promise<
    PedidoBaseCapacidade & {
      cobertura: CoberturaCapacidade;
      disponibilidade: ParametrosDisponibilidade;
      demandas: readonly { origemId: string; minutosInternos: number | null }[];
    }
  >;
}

/** Os dados devem vir autorizados, com origem canônica e intervalos de desconto sem sobreposição. */
export async function consultarResumoCapacidade(
  gateway: ResumoCapacidadeGateway,
  pedido: PedidoBaseCapacidade,
  signal?: AbortSignal,
) {
  let resposta: Awaited<ReturnType<ResumoCapacidadeGateway["consultar"]>> | undefined;
  const cobertura = await conferirBaseCapacidade(
    {
      consultar: async (contexto, abort) => {
        resposta = await gateway.consultar(contexto, abort);
        return resposta;
      },
    },
    pedido,
    signal,
  );
  if (!resposta) throw new Error("Resposta de capacidade ausente.");
  const disponibilidade = calcularDisponibilidade(resposta.disponibilidade);
  const origens = new Set<string>();
  let demandaConhecidaMinutos = 0;
  let demandasSemEstimativa = 0;
  for (const demanda of resposta.demandas) {
    const identidade = chaveOrigem(demanda.origemId.trim());
    if (!identidade || demanda.origemId !== demanda.origemId.trim() || origens.has(identidade))
      throw new Error("Origem de demanda inválida ou duplicada.");
    origens.add(identidade);
    if (demanda.minutosInternos === null || demanda.minutosInternos === 0) {
      demandasSemEstimativa++;
      continue;
    }
    if (!Number.isSafeInteger(demanda.minutosInternos) || demanda.minutosInternos < 0)
      throw new Error("Demanda inválida.");
    demandaConhecidaMinutos += demanda.minutosInternos;
    if (!Number.isSafeInteger(demandaConhecidaMinutos))
      throw new Error("Demanda excede precisão segura.");
  }
  const disponiveisMinutos = disponibilidade.disponiveisMinutos;
  return {
    ...disponibilidade,
    demandaConhecidaMinutos,
    demandasSemEstimativa,
    cobertura,
    saldoMinutos:
      cobertura.situacao === "cobertura_informada" &&
      disponiveisMinutos !== null &&
      demandasSemEstimativa === 0
        ? disponiveisMinutos - demandaConhecidaMinutos
        : null,
  };
}
