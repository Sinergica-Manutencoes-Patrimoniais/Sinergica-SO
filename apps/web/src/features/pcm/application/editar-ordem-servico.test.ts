import { describe, expect, it, vi } from "vitest";
import { PESOS_GUTD_PADRAO } from "../domain/priorizacao-backlog";
import { editarOrdemServico } from "./editar-ordem-servico";
import type { OrdemServicoGateway } from "./ordem-servico-gateway";

function gatewayFake(): OrdemServicoGateway {
  return {
    carregarDadosAbertura: vi.fn(),
    criarOrdemServico: vi.fn(),
    editarOrdemServico: vi.fn().mockResolvedValue(undefined),
    iaTituloAtiva: vi.fn(),
    gerarTituloOs: vi.fn(),
    obterPesosGutd: vi.fn(async () => PESOS_GUTD_PADRAO),
  };
}

const INPUT_BASE = {
  id: "os1",
  titulo: "Reparo vazamento",
  descricao: null,
  categoria: "corretiva" as const,
  prioridade: "media" as const,
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
  dorCliente: null,
  observacao: null,
  tecnicoId: null,
  dataPrevista: null,
  updatedBy: "user1",
};

describe("editarOrdemServico", () => {
  it("chama o gateway com título normalizado", async () => {
    const gateway = gatewayFake();
    await editarOrdemServico(gateway, { ...INPUT_BASE, titulo: "  Reparo vazamento  " });
    expect(gateway.editarOrdemServico).toHaveBeenCalledWith({
      ...INPUT_BASE,
      titulo: "Reparo vazamento",
    });
  });

  it("bloqueia sem id", async () => {
    const gateway = gatewayFake();
    await expect(editarOrdemServico(gateway, { ...INPUT_BASE, id: "" })).rejects.toThrow(
      "OS é obrigatória.",
    );
  });

  it("bloqueia sem título", async () => {
    const gateway = gatewayFake();
    await expect(editarOrdemServico(gateway, { ...INPUT_BASE, titulo: "  " })).rejects.toThrow(
      "Título é obrigatório.",
    );
  });
});
