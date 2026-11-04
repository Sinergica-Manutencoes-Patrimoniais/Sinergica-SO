import { describe, expect, it, vi } from "vitest";
import { definirConcessao } from "./capacidades-sso";
import type { CapacidadesSsoGateway } from "./capacidades-sso-gateway";

const comando = {
  requestId: "17010000-0000-0000-0000-000000000101",
  expectedRevision: 0,
  usuarioId: "17010000-0000-0000-0000-000000000002",
  perfilId: null,
  acao: "plano.gerir" as const,
  clienteId: "17010000-0000-0000-0000-00000000000a",
  ativa: true,
  motivo: "Responsabilidade PCM",
};

function gateway() {
  const definir = vi.fn().mockResolvedValue({
    aggregateId: "17010000-0000-0000-0000-000000000010",
    revision: 1,
    state: true,
    created: true,
    linkedIds: {},
    warnings: [],
    requestId: comando.requestId,
  });
  return { definir, porta: { definirConcessao: definir } as unknown as CapacidadesSsoGateway };
}

describe("definir concessão", () => {
  it("mantém requestId e revisão nas repetidas tentativas", async () => {
    const { definir, porta } = gateway();
    await definirConcessao(porta, comando);
    await definirConcessao(porta, comando);
    expect(definir).toHaveBeenCalledTimes(2);
    expect(definir).toHaveBeenLastCalledWith(comando);
  });
  it("recusa motivo vazio, escopo inválido e concessão de Plano a perfil", async () => {
    const { definir, porta } = gateway();
    await expect(definirConcessao(porta, { ...comando, motivo: "  " })).rejects.toThrow();
    await expect(definirConcessao(porta, { ...comando, clienteId: "não-uuid" })).rejects.toThrow();
    await expect(
      definirConcessao(porta, { ...comando, usuarioId: null, perfilId: comando.usuarioId }),
    ).rejects.toThrow();
    expect(definir).not.toHaveBeenCalled();
  });
  it("rejeita sujeito duplo e revisão negativa", async () => {
    const { definir, porta } = gateway();
    await expect(
      definirConcessao(porta, { ...comando, perfilId: comando.usuarioId }),
    ).rejects.toThrow();
    await expect(definirConcessao(porta, { ...comando, expectedRevision: -1 })).rejects.toThrow();
    expect(definir).not.toHaveBeenCalled();
  });
});
