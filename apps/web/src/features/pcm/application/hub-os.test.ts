import { describe, expect, it, vi } from "vitest";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import { listarBacklogGut, planejarOrdemServico } from "./hub-os";
import type { HubOsGateway } from "./hub-os-gateway";

const ordem = (patch: Partial<OrdemServicoOperacional>): OrdemServicoOperacional => ({
  id: "os-1",
  numero: "CH-001",
  titulo: "Teste",
  clienteNome: "Cliente",
  categoria: "corretiva",
  status: "solicitacao",
  prioridade: "media",
  scorePcm: 27,
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
  auvoTaskId: null,
  auvoSyncStatus: null,
  auvoSyncError: null,
  createdAt: "2026-07-04T10:00:00Z",
  tecnicoFuncionarioId: null,
  tecnicoNome: null,
  dataAgendada: null,
  checkInAt: null,
  checkOutAt: null,
  detalhes: null,
  ...patch,
});

describe("hub-os", () => {
  it("lista backlog GUT ordenado e sem históricos", async () => {
    const gateway: HubOsGateway = {
      listarOrdensServico: vi.fn(async () => [
        ordem({ id: "baixa", scorePcm: 8 }),
        ordem({ id: "finalizada", status: "finalizado", scorePcm: 125 }),
        ordem({ id: "alta", scorePcm: 80 }),
      ]),
      alterarStatus: vi.fn(),
    };

    expect((await listarBacklogGut(gateway)).map((item) => item.id)).toEqual(["alta", "baixa"]);
  });

  it("planejar OS altera status para planejamento", async () => {
    const gateway: HubOsGateway = {
      listarOrdensServico: vi.fn(),
      alterarStatus: vi.fn(async (input) => ordem({ id: input.id, status: input.status })),
    };

    await planejarOrdemServico(gateway, { id: "os-1", updatedBy: "user-1" });

    expect(gateway.alterarStatus).toHaveBeenCalledWith({
      id: "os-1",
      status: "planejamento",
      updatedBy: "user-1",
    });
  });
});
