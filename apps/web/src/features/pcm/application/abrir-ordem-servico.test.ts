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
  tipoTarefaId: "tipo1",
  dataPrevista: null,
  createdBy: "u1",
};

function gatewayMock(): OrdemServicoGateway {
  return {
    carregarDadosAbertura: vi.fn(async () => ({ clientes: [], tecnicos: [], tiposTarefa: [] })),
    criarOrdemServico: vi.fn(async () => ({ id: "os1", numero: "CH-001" })),
    editarOrdemServico: vi.fn(async () => undefined),
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

  it("AC-2 (E01-S39): rejeita tipo de tarefa vazio antes do gateway", async () => {
    await expect(abrirOrdemServico(gatewayMock(), { ...input, tipoTarefaId: "" })).rejects.toThrow(
      /Tipo de tarefa/,
    );
  });
});
