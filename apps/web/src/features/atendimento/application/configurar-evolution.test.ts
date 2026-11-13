import { describe, expect, it, vi } from "vitest";
import { configurarInstanciaEvolution } from "./configurar-evolution";
import type { PortaDeConfiguracaoEvolution } from "./configurar-evolution";

function portaFake(
  overrides: Partial<PortaDeConfiguracaoEvolution> = {},
): PortaDeConfiguracaoEvolution {
  return {
    criarInstancia: vi.fn().mockResolvedValue({ estado: "criando", jaExistia: false }),
    instalarWebhook: vi.fn().mockResolvedValue({ estado: "aguardando_pareamento" }),
    ...overrides,
  };
}

describe("configurarInstanciaEvolution", () => {
  it("recusa canalId vazio", async () => {
    await expect(configurarInstanciaEvolution(portaFake(), "  ")).rejects.toThrow(
      "Canal é obrigatório",
    );
  });

  it("cria a instância e instala o webhook em sequência, devolve o estado final", async () => {
    const porta = portaFake();
    const resultado = await configurarInstanciaEvolution(porta, "canal-1");
    expect(porta.criarInstancia).toHaveBeenCalledWith("canal-1");
    expect(porta.instalarWebhook).toHaveBeenCalledWith("canal-1");
    expect(resultado).toEqual({ estado: "aguardando_pareamento", adotada: false });
  });

  it("propaga adotada=true quando a instância já estava conectada (instância legada)", async () => {
    const porta = portaFake({
      criarInstancia: vi
        .fn()
        .mockResolvedValue({ estado: "conectado_verificado", jaExistia: false, adotada: true }),
      instalarWebhook: vi.fn().mockResolvedValue({ estado: "conectado_verificado" }),
    });
    const resultado = await configurarInstanciaEvolution(porta, "canal-1");
    expect(resultado).toEqual({ estado: "conectado_verificado", adotada: true });
  });

  it("sobe o erro de instalarWebhook sem disfarce (AC-5)", async () => {
    const porta = portaFake({
      instalarWebhook: vi.fn().mockRejectedValue(new Error("webhook_falhou")),
    });
    await expect(configurarInstanciaEvolution(porta, "canal-1")).rejects.toThrow("webhook_falhou");
  });
});
