import { describe, expect, it, vi } from "vitest";
import {
  conectarEvolution,
  criarEvolution,
  desconectarEvolution,
  listarEvolution,
  sincronizarWebhookEvolution,
} from "./evolution";
import type { EvolutionGateway } from "./evolution-gateway";

function gatewayFake(): EvolutionGateway {
  return {
    listar: vi.fn().mockResolvedValue([]),
    criar: vi.fn().mockResolvedValue({
      instancia: {
        id: "evo-1",
        label: "Atendimento",
        instanceName: "sinergica",
        numeroVinculado: null,
        status: "desconectado",
        webhookRegistrado: true,
        ativo: true,
        erro: null,
      },
      qrCode: "data:image/png;base64,abc",
    }),
    conectar: vi.fn(),
    sincronizarWebhook: vi.fn(),
    desconectar: vi.fn(),
  };
}

describe("casos de uso Evolution", () => {
  it("lista delegando ao gateway", async () => {
    const gateway = gatewayFake();
    await listarEvolution(gateway);
    expect(gateway.listar).toHaveBeenCalledOnce();
  });

  it("normaliza e cria uma instância", async () => {
    const gateway = gatewayFake();
    await criarEvolution(gateway, {
      label: " Atendimento ",
      instanceName: " sinergica_01 ",
      userId: "user-1",
    });
    expect(gateway.criar).toHaveBeenCalledWith({
      label: "Atendimento",
      instanceName: "sinergica_01",
      userId: "user-1",
    });
  });

  it("rejeita Instance ID inseguro antes do gateway", () => {
    const gateway = gatewayFake();
    expect(() =>
      criarEvolution(gateway, {
        label: "Atendimento",
        instanceName: "../outra",
        userId: "user-1",
      }),
    ).toThrow("Instance ID aceita apenas");
    expect(gateway.criar).not.toHaveBeenCalled();
  });

  it("exige id nas ações de conexão", () => {
    const gateway = gatewayFake();
    expect(() => conectarEvolution(gateway, " ")).toThrow("Instância Evolution é obrigatória.");
    expect(() => desconectarEvolution(gateway, "")).toThrow("Instância Evolution é obrigatória.");
    expect(() => sincronizarWebhookEvolution(gateway, "")).toThrow(
      "Instância Evolution é obrigatória.",
    );
  });
});
