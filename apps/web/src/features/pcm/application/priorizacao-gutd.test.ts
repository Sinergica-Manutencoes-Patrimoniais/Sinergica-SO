import { describe, expect, it, vi } from "vitest";
import { PESOS_GUTD_PADRAO } from "../domain/priorizacao-backlog";
import { obterPesosGutdConfig, salvarPesosGutd } from "./priorizacao-gutd";
import type { PriorizacaoGutdGateway } from "./priorizacao-gutd-gateway";

function gatewayFake(): PriorizacaoGutdGateway {
  return {
    obterPesos: vi.fn(async () => PESOS_GUTD_PADRAO),
    salvarPesos: vi.fn(async () => undefined),
  };
}

describe("priorizacao-gutd (use case)", () => {
  it("repassa a leitura ao gateway", async () => {
    const gateway = gatewayFake();
    expect(await obterPesosGutdConfig(gateway)).toEqual(PESOS_GUTD_PADRAO);
  });

  it("salva quando os pesos somam 100", async () => {
    const gateway = gatewayFake();
    const pesos = { gravidade: 40, urgencia: 30, tendencia: 20, dorCliente: 10 };
    await salvarPesosGutd(gateway, pesos, "user-1");
    expect(gateway.salvarPesos).toHaveBeenCalledWith(pesos, "user-1");
  });

  it("rejeita antes de chamar o gateway quando a soma diverge de 100", async () => {
    const gateway = gatewayFake();
    const pesos = { gravidade: 50, urgencia: 30, tendencia: 20, dorCliente: 10 };
    await expect(salvarPesosGutd(gateway, pesos, "user-1")).rejects.toThrow(/somar 100/);
    expect(gateway.salvarPesos).not.toHaveBeenCalled();
  });
});
