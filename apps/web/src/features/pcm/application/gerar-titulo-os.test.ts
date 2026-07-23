import { describe, expect, it, vi } from "vitest";
import { PESOS_GUTD_PADRAO } from "../domain/priorizacao-backlog";
import { gerarTituloOs, iaTituloAtiva } from "./gerar-titulo-os";
import type { OrdemServicoGateway } from "./ordem-servico-gateway";

function gatewayFake(overrides: Partial<OrdemServicoGateway> = {}): OrdemServicoGateway {
  return {
    carregarDadosAbertura: vi.fn(),
    criarOrdemServico: vi.fn(),
    editarOrdemServico: vi.fn(),
    iaTituloAtiva: vi.fn().mockResolvedValue(true),
    gerarTituloOs: vi.fn().mockResolvedValue("Troca de lâmpada"),
    obterPesosGutd: vi.fn(async () => PESOS_GUTD_PADRAO),
    ...overrides,
  };
}

describe("gerarTituloOs (use case)", () => {
  it("rejeita descrição vazia sem chamar o gateway (edge case AC-2)", async () => {
    const gateway = gatewayFake();
    await expect(gerarTituloOs(gateway, "  ")).rejects.toThrow(
      "Descrição é obrigatória para gerar o título.",
    );
    expect(gateway.gerarTituloOs).not.toHaveBeenCalled();
  });

  it("saneia o retorno bruto do gateway antes de devolver", async () => {
    const gateway = gatewayFake({ gerarTituloOs: vi.fn().mockResolvedValue('"Troca de lâmpada"') });
    const titulo = await gerarTituloOs(gateway, "lâmpada queimada no corredor");
    expect(titulo).toBe("Troca de lâmpada");
  });
});

describe("iaTituloAtiva (use case)", () => {
  it("repassa o gateway", async () => {
    const gateway = gatewayFake({ iaTituloAtiva: vi.fn().mockResolvedValue(false) });
    expect(await iaTituloAtiva(gateway)).toBe(false);
  });
});
