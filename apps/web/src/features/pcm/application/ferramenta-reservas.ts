import {
  validarCancelarReserva,
  validarCriarReserva,
  validarEfetivarReserva,
} from "../domain/ferramenta-reservas";
import type {
  CancelarReservaCommand,
  CriarReservaCommand,
  EfetivarReservaCommand,
  FerramentaReservasGateway,
} from "./ferramenta-reservas-gateway";
import { atribuirUnidadeFerramenta } from "./ferramenta-unidades";
import type { FerramentaUnidadesGateway } from "./ferramenta-unidades-gateway";

export function listarReservasFerramenta(gateway: FerramentaReservasGateway) {
  return gateway.listarReservas();
}

export async function criarReservaFerramenta(
  gateway: FerramentaReservasGateway,
  unidadesGateway: FerramentaUnidadesGateway,
  input: CriarReservaCommand,
) {
  const [unidades, reservas] = await Promise.all([
    unidadesGateway.listarUnidades(),
    gateway.listarReservas(),
  ]);
  const unidadesDaFerramenta = unidades.filter((u) => u.ferramentaId === input.ferramentaId);
  const reservasPendentes = reservas.filter(
    (r) => r.ferramentaId === input.ferramentaId && r.status === "pendente",
  );
  const validado = validarCriarReserva(input, unidadesDaFerramenta, reservasPendentes);
  return gateway.criar({ ...validado, userId: input.userId });
}

export async function efetivarReservaFerramenta(
  gateway: FerramentaReservasGateway,
  unidadesGateway: FerramentaUnidadesGateway,
  input: EfetivarReservaCommand,
) {
  const [reservas, unidades] = await Promise.all([
    gateway.listarReservas(),
    unidadesGateway.listarUnidades(),
  ]);
  const reserva = reservas.find((r) => r.id === input.reservaId);
  const unidade = unidades.find((u) => u.id === input.unidadeId);
  validarEfetivarReserva(input, reserva, unidade);
  await atribuirUnidadeFerramenta(unidadesGateway, {
    unidadeId: input.unidadeId,
    funcionarioId: (reserva as NonNullable<typeof reserva>).funcionarioId,
    userId: input.userId,
  });
  await gateway.marcarEfetivada(input.reservaId, input.unidadeId, input.userId);
}

export async function cancelarReservaFerramenta(
  gateway: FerramentaReservasGateway,
  input: CancelarReservaCommand,
) {
  const reservas = await gateway.listarReservas();
  const reserva = reservas.find((r) => r.id === input.reservaId);
  const validado = validarCancelarReserva(input, reserva);
  await gateway.cancelar({ ...validado, userId: input.userId });
}
