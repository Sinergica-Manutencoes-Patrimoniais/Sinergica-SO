import { describe, expect, it, vi } from "vitest";
import { criarRegraContratual } from "./calendario-contratual";
const comando = {
  requestId: "16600000-0000-4000-8000-000000000101",
  expectedRevision: 0,
  clienteId: "16600000-0000-4000-8000-00000000000a",
  serieId: "16600000-0000-4000-8000-000000000061",
  regraId: "16600000-0000-4000-8000-000000000071",
  contratoId: "16600000-0000-4000-8000-000000000051",
  ancoraSemana: "2026-10-05",
  diaSemana: 5,
  intervaloSemanas: 1,
  horaInicio: "08:00",
  duracaoMinutos: 120,
  deslocamentoMinutos: 30,
  fuso: "America/Sao_Paulo",
  vigenciaInicio: "2026-10-01",
  vigenciaFim: null,
};
describe("criação de regra contratual", () => {
  it("envia o comando validado sem criar Visita", async () => {
    const gateway = { criarRegra: vi.fn().mockResolvedValue({ revision: 1 }) };
    await expect(criarRegraContratual(gateway, comando)).resolves.toEqual({ revision: 1 });
    expect(gateway.criarRegra).toHaveBeenCalledExactlyOnceWith(comando);
  });
  it.each([
    { expectedRevision: 1 },
    { ancoraSemana: "2026-10-06" },
    { vigenciaInicio: "2026-02-30" },
    { vigenciaFim: "2026-09-30" },
    { diaSemana: 8 },
    { intervaloSemanas: 0 },
    { horaInicio: "24:00" },
    { duracaoMinutos: 0 },
    { deslocamentoMinutos: -1 },
    { fuso: " " },
    { fuso: "America/Local_Inexistente" },
  ])("rejeita entrada inválida antes de enviar: %o", async (alteracao) => {
    const gateway = { criarRegra: vi.fn() };
    await expect(criarRegraContratual(gateway, { ...comando, ...alteracao })).rejects.toThrow();
    expect(gateway.criarRegra).not.toHaveBeenCalled();
  });
});
