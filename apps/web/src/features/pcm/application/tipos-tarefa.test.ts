import { describe, expect, it, vi } from "vitest";
import { criarTipoTarefa, editarTipoTarefa, excluirTipoTarefa } from "./tipos-tarefa";
import type { TiposTarefaGateway } from "./tipos-tarefa-gateway";

function gatewayMock(): TiposTarefaGateway {
  return {
    listar: vi.fn(),
    criar: vi.fn(async (input) => ({
      id: "tipo-1",
      nome: input.nome,
      preencheRelato: input.preencheRelato,
      exigeAssinatura: input.exigeAssinatura,
      fotosMinimas: input.fotosMinimas,
      ativo: input.ativo ?? true,
      auvoId: null,
      auvoSyncStatus: "pending",
      auvoSyncError: null,
      auvoSyncedAt: null,
    })),
    editar: vi.fn(async (input) => ({
      id: input.id,
      nome: input.nome,
      preencheRelato: input.preencheRelato,
      exigeAssinatura: input.exigeAssinatura,
      fotosMinimas: input.fotosMinimas,
      ativo: input.ativo ?? true,
      auvoId: null,
      auvoSyncStatus: "pending",
      auvoSyncError: null,
      auvoSyncedAt: null,
    })),
    excluir: vi.fn(async () => undefined),
  };
}

describe("tipos-tarefa use cases", () => {
  it("criar valida e delega ao gateway", async () => {
    const gateway = gatewayMock();
    await criarTipoTarefa(gateway, {
      nome: " Preventiva ",
      preencheRelato: true,
      exigeAssinatura: false,
      fotosMinimas: 1,
      userId: "user-1",
    });
    expect(gateway.criar).toHaveBeenCalledWith({
      nome: "Preventiva",
      preencheRelato: true,
      exigeAssinatura: false,
      fotosMinimas: 1,
      ativo: true,
      userId: "user-1",
    });
  });

  it("editar preserva id e userId após validação", async () => {
    const gateway = gatewayMock();
    await editarTipoTarefa(gateway, {
      id: "tipo-1",
      nome: "Corretiva",
      preencheRelato: false,
      exigeAssinatura: true,
      fotosMinimas: 0,
      ativo: true,
      userId: "user-1",
    });
    expect(gateway.editar).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tipo-1", userId: "user-1", nome: "Corretiva" }),
    );
  });

  it("excluir exige id", async () => {
    const gateway = gatewayMock();
    expect(() => excluirTipoTarefa(gateway, { id: "", userId: "user-1" })).toThrow(
      "Tipo de tarefa é obrigatório.",
    );
  });
});
