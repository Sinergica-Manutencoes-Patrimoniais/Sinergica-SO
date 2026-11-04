import { describe, expect, it, vi } from "vitest";
import {
  adicionarRotina,
  adicionarRotinaCompleta,
  editarRotina,
  retirarRotinaRascunho,
  salvarPlanoRascunho,
} from "./plano-manutencao";

const requestId = "16500000-0000-4000-8000-000000000101";
const planoId = "16500000-0000-4000-8000-000000000011";
const clienteId = "16500000-0000-4000-8000-00000000000a";
const rotina = {
  requestId,
  expectedRevision: 1,
  planoId,
  rotinaId: "16500000-0000-4000-8000-000000000081",
  nome: " Mensal ",
  alvoTipo: "sistema" as const,
  alvoId: "16500000-0000-4000-8000-000000000051",
  modo: "calendario" as const,
  intervalo: 1,
  unidade: "meses" as const,
  dataBase: "2026-11-01",
  tempoMinutos: 45,
};
const resultado = {
  aggregateId: planoId,
  revision: 2,
  state: "rascunho" as const,
  created: false,
  linkedIds: { clienteId },
  warnings: [],
  requestId,
};

describe("comandos do Plano de Manutenção", () => {
  it("valida motivo e identidade antes de retirar Rotina do rascunho", async () => {
    const gateway = { retirarRotina: vi.fn().mockResolvedValue(resultado) };
    const comando = { requestId, expectedRevision: 1, planoId, rotinaId: rotina.rotinaId, motivo: "  Escopo revisado  " };
    await retirarRotinaRascunho(gateway, comando);
    expect(gateway.retirarRotina).toHaveBeenCalledExactlyOnceWith({ ...comando, motivo: "Escopo revisado" });
    await expect(retirarRotinaRascunho(gateway, { ...comando, motivo: "  " })).rejects.toThrow();
    expect(gateway.retirarRotina).toHaveBeenCalledTimes(1);
  });
  it("valida e envia rascunho sem produzir execução", async () => {
    const gateway = { salvarPlano: vi.fn().mockResolvedValue(resultado) };
    await expect(
      salvarPlanoRascunho(gateway, {
        requestId,
        expectedRevision: 0,
        planoId,
        clienteId,
        nome: " Preventivo ",
      }),
    ).resolves.toEqual(resultado);
    expect(gateway.salvarPlano).toHaveBeenCalledExactlyOnceWith({
      requestId,
      expectedRevision: 0,
      planoId,
      clienteId,
      nome: "Preventivo",
    });
  });
  it("envia Rotina com alvo único e preserva revisão", async () => {
    const gateway = { adicionarRotina: vi.fn().mockResolvedValue(resultado) };
    await adicionarRotina(gateway, rotina);
    expect(gateway.adicionarRotina).toHaveBeenCalledExactlyOnceWith({ ...rotina, nome: "Mensal" });
  });
  it("envia referência de tempo e tolerâncias na edição", async () => {
    const gateway = { editarRotina: vi.fn().mockResolvedValue(resultado) };
    const edicao = {
      ...rotina,
      toleranciaAntes: 2,
      toleranciaDepois: 3,
      instrucao: "Inspecionar",
      questionarioId: null,
      tipoTempo: "total" as const,
    };
    await editarRotina(gateway, edicao);
    expect(gateway.editarRotina).toHaveBeenCalledExactlyOnceWith({ ...edicao, nome: "Mensal" });
  });
  it("cria Rotina com todos os dados em uma única operação", async () => {
    const gateway = { adicionarRotinaCompleta: vi.fn().mockResolvedValue(resultado) };
    const comando = {
      ...rotina,
      toleranciaAntes: 2,
      toleranciaDepois: 3,
      instrucao: "Inspecionar",
      questionarioId: null,
      tipoTempo: "por_unidade" as const,
    };
    await adicionarRotinaCompleta(gateway, comando);
    expect(gateway.adicionarRotinaCompleta).toHaveBeenCalledExactlyOnceWith({
      ...comando,
      nome: "Mensal",
    });
  });
  it.each([
    { intervalo: 0 },
    { alvoId: "outro" },
    { expectedRevision: 0 },
    { dataBase: "2026-02-30" },
  ])("rejeita Rotina inválida antes do envio: %o", async (alteracao) => {
    const gateway = { adicionarRotina: vi.fn() };
    await expect(adicionarRotina(gateway, { ...rotina, ...alteracao })).rejects.toThrow();
    expect(gateway.adicionarRotina).not.toHaveBeenCalled();
  });
});
