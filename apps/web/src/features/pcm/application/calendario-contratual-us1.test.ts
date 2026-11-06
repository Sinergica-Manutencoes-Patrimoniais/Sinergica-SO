import { describe, expect, it, vi } from "vitest";
import { criarRegraContratual } from "./calendario-contratual";
import type { CriarRegraContratualCommand, ResultadoRegraContratual } from "./calendario-contratual-gateway";

const id = (n: number) => `16610000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const comando: CriarRegraContratualCommand = {
  requestId: id(1), expectedRevision: 0, clienteId: id(2), serieId: id(3), regraId: id(4), contratoId: id(5),
  ancoraSemana: "2026-10-05", diaSemana: 5, intervaloSemanas: 1, horaInicio: "09:00", duracaoMinutos: 60,
  deslocamentoMinutos: 0, fuso: "America/Sao_Paulo", vigenciaInicio: "2026-10-05", vigenciaFim: null,
};
const recibo: ResultadoRegraContratual = {
  aggregateId: id(3), revision: 1, state: "registrada", created: true,
  linkedIds: { clienteId: id(2), contratoId: id(5), regraId: id(4) }, warnings: [], requestId: id(1),
};

describe("E01-S166 US1 — comando para regra contratual", () => {
  it("valida calendário, Cliente, série e requestId antes de delegar", async () => {
    const gateway = { criarRegra: vi.fn().mockResolvedValue(recibo) };
    await expect(criarRegraContratual(gateway, comando)).resolves.toEqual(recibo);
    expect(gateway.criarRegra).toHaveBeenCalledWith(comando);
    await expect(criarRegraContratual(gateway, { ...comando, ancoraSemana: "2026-10-06" })).rejects.toThrow("A âncora deve ser segunda-feira.");
    await expect(criarRegraContratual(gateway, { ...comando, clienteId: "cliente-invalido" })).rejects.toThrow();
    expect(gateway.criarRegra).toHaveBeenCalledTimes(1);
  });

  it("reusa exatamente o requestId após falha e propaga rejeição transacional", async () => {
    const falha = Object.assign(new Error("revisao_obsoleta"), { code: "P0011" });
    const gateway = { criarRegra: vi.fn().mockRejectedValue(falha) };
    await expect(criarRegraContratual(gateway, comando)).rejects.toBe(falha);
    await expect(criarRegraContratual(gateway, comando)).rejects.toBe(falha);
    expect(gateway.criarRegra.mock.calls).toEqual([[comando], [comando]]);
    expect(gateway.criarRegra.mock.calls[0]?.[0].requestId).toBe(gateway.criarRegra.mock.calls[1]?.[0].requestId);
  });

  it("preserva o Cliente solicitado sem trocar a referência no caso de uso", async () => {
    const gateway = { criarRegra: vi.fn().mockResolvedValue({ ...recibo, linkedIds: { ...recibo.linkedIds, clienteId: id(99) } }) };
    await expect(criarRegraContratual(gateway, comando)).rejects.toThrow("Resposta da regra contratual não corresponde ao pedido.");
    expect(gateway.criarRegra).toHaveBeenCalledWith(expect.objectContaining({ clienteId: id(2) }));
  });
});
