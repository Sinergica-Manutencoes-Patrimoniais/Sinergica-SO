import { describe, expect, it, vi } from "vitest";
import { projetarVencimentosPorCalendario } from "../domain/calendario-contratual";
import { criarRegraContratual } from "./calendario-contratual";
import type { CriarRegraContratualCommand } from "./calendario-contratual-gateway";

const id = (n: number) => `16620000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const comando: CriarRegraContratualCommand = {
  requestId: id(1), expectedRevision: 0, clienteId: id(2), serieId: id(3), regraId: id(4), contratoId: id(5),
  ancoraSemana: "2026-10-05", diaSemana: 1, intervaloSemanas: 1, horaInicio: "09:00", duracaoMinutos: 45,
  deslocamentoMinutos: 0, fuso: "America/Sao_Paulo", vigenciaInicio: "2026-10-05", vigenciaFim: null,
};
const recibo = {
  aggregateId: id(3), revision: 1, state: "registrada", created: true,
  linkedIds: { clienteId: id(2), contratoId: id(5), regraId: id(4) }, warnings: [], requestId: id(1),
};

describe("E01-S166 US2 — persistência e projeção idempotente", () => {
  it("reenvia a mesma revisão e identidade, e projeta vencimentos da âncora sem mover o ciclo", async () => {
    const gateway = { criarRegra: vi.fn().mockResolvedValue(recibo) };
    const [primeiro, repetido] = await Promise.all([
      criarRegraContratual(gateway, comando),
      criarRegraContratual(gateway, comando),
    ]);
    expect(primeiro).toEqual(repetido);
    expect(gateway.criarRegra).toHaveBeenCalledTimes(2);
    expect(gateway.criarRegra.mock.calls.map(([pedido]) => [pedido.requestId, pedido.expectedRevision, pedido.clienteId])).toEqual([
      [id(1), 0, id(2)], [id(1), 0, id(2)],
    ]);
    expect(projetarVencimentosPorCalendario({
      dataBase: "2027-01-31", intervalo: 1, unidade: "meses", inicio: "2027-01-01", fim: "2027-03-31", feriados: ["2027-02-28"],
    }).map(({ ciclo, vencimento, feriado }) => [ciclo, vencimento, feriado])).toEqual([
      [0, "2027-01-31", false], [1, "2027-02-28", true], [2, "2027-03-31", false],
    ]);
  });

  it("não transforma divergência de Cliente no recibo do servidor em sucesso", async () => {
    const gateway = { criarRegra: vi.fn().mockResolvedValue({ ...recibo, linkedIds: { ...recibo.linkedIds, contratoId: id(88) } }) };
    await expect(criarRegraContratual(gateway, comando)).rejects.toThrow("Resposta da regra contratual não corresponde ao pedido.");
    expect(gateway.criarRegra).toHaveBeenCalledWith(expect.objectContaining({ clienteId: id(2), contratoId: id(5) }));
  });
});
