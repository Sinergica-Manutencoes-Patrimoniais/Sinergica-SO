import { describe, expect, it, vi } from "vitest";
import { criarClienteGrupo, excluirClienteGrupo } from "./cliente-grupos";
import type { ClienteGruposGateway } from "./cliente-grupos-gateway";

function gatewayMock(): ClienteGruposGateway {
  return {
    listar: vi.fn(async () => []),
    listarClientesSincronizados: vi.fn(async () => []),
    criar: vi.fn(async (input) => ({
      id: "g1",
      nome: input.nome,
      clienteIds: input.clienteIds,
      clientesAuvoIds: [10],
      auvoId: null,
      auvoSyncStatus: "pending",
      auvoSyncError: null,
      auvoSyncedAt: null,
    })),
    editar: vi.fn(),
    excluir: vi.fn(async () => undefined),
  };
}

describe("cliente-grupos application", () => {
  it("valida e encaminha criação ao gateway", async () => {
    const gateway = gatewayMock();
    await criarClienteGrupo(gateway, { nome: " Grupo ", clienteIds: ["c1"], userId: "u1" });
    expect(gateway.criar).toHaveBeenCalledWith({
      nome: "Grupo",
      clienteIds: ["c1"],
      userId: "u1",
    });
  });

  it("exige id na exclusão", async () => {
    const gateway = gatewayMock();
    expect(() => excluirClienteGrupo(gateway, { id: "", userId: "u1" })).toThrow(
      "Grupo é obrigatório.",
    );
  });
});
