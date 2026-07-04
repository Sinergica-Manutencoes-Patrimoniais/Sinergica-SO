import { describe, expect, it, vi } from "vitest";
import { abrirOrdemServico } from "./abrir-ordem-servico";
import type { CriarOrdemServicoInput, OrdemServicoGateway } from "./ordem-servico-gateway";

const input: CriarOrdemServicoInput = {
  clientId: "c1",
  titulo: " Vazamento ",
  descricao: null,
  categoria: "corretiva",
  prioridade: "alta",
  gravidade: 4,
  urgencia: 4,
  tendencia: 4,
  localDescricao: "Garagem",
  solicitante: "João",
  origem: "manual",
  tecnicoId: null,
  tipoAuvo: "corretiva",
  dataPrevista: null,
  createdBy: "u1",
};

function gatewayMock(): OrdemServicoGateway {
  return {
    carregarDadosAbertura: vi.fn(async () => ({ clientes: [], tecnicos: [] })),
    criarOrdemServico: vi.fn(async () => ({ id: "os1", numero: "CH-001" })),
  };
}

describe("abrirOrdemServico", () => {
  it("AC-4: normaliza título e delega criação ao gateway", async () => {
    const gateway = gatewayMock();
    await abrirOrdemServico(gateway, input);
    expect(gateway.criarOrdemServico).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Vazamento" }),
    );
  });

  it("AC-5: rejeita cliente vazio antes do gateway", async () => {
    await expect(abrirOrdemServico(gatewayMock(), { ...input, clientId: "" })).rejects.toThrow(
      /Cliente/,
    );
  });

  it("AC-5: rejeita título vazio antes do gateway", async () => {
    await expect(abrirOrdemServico(gatewayMock(), { ...input, titulo: "   " })).rejects.toThrow(
      /Título/,
    );
  });
});
