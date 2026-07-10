import { describe, expect, it, vi } from "vitest";
import type { KpisOrdensServico, OrdemServicoOperacional } from "../domain/ordens-servico";
import { alterarStatusEmLote, listarBacklogGut, planejarOrdemServico } from "./hub-os";
import type { HubOsGateway } from "./hub-os-gateway";

const KPIS_ZERADOS: KpisOrdensServico = {
  total: 0,
  abertas: 0,
  emPlanejamento: 0,
  emExecucao: 0,
  finalizadas: 0,
  criticas: 0,
};

const ordem = (patch: Partial<OrdemServicoOperacional>): OrdemServicoOperacional => ({
  id: "os-1",
  numero: "CH-001",
  titulo: "Teste",
  descricao: null,
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
      contarKpis: vi.fn(async () => KPIS_ZERADOS),
      alterarStatus: vi.fn(),
    };

    expect((await listarBacklogGut(gateway)).map((item) => item.id)).toEqual(["alta", "baixa"]);
  });

  it("planejar OS altera status para planejamento", async () => {
    const gateway: HubOsGateway = {
      listarOrdensServico: vi.fn(),
      contarKpis: vi.fn(async () => KPIS_ZERADOS),
      alterarStatus: vi.fn(async (input) => ordem({ id: input.id, status: input.status })),
    };

    await planejarOrdemServico(gateway, { id: "os-1", updatedBy: "user-1" });

    expect(gateway.alterarStatus).toHaveBeenCalledWith({
      id: "os-1",
      status: "planejamento",
      updatedBy: "user-1",
    });
  });

  it("E01-S43: alterarStatusEmLote — falha isolada não trava as demais", async () => {
    const gateway: HubOsGateway = {
      listarOrdensServico: vi.fn(),
      contarKpis: vi.fn(async () => KPIS_ZERADOS),
      alterarStatus: vi.fn(async (input) => {
        if (input.id === "os-2") throw new Error("RLS negou");
        return ordem({ id: input.id, status: input.status });
      }),
    };

    const resultado = await alterarStatusEmLote(
      gateway,
      ["os-1", "os-2", "os-3"],
      "planejamento",
      "user-1",
    );

    expect(resultado.sucesso).toEqual(["os-1", "os-3"]);
    expect(resultado.falhas).toEqual([{ id: "os-2", erro: "RLS negou" }]);
    expect(gateway.alterarStatus).toHaveBeenCalledTimes(3);
  });

  it("E01-S43: alterarStatusEmLote — sucesso total", async () => {
    const gateway: HubOsGateway = {
      listarOrdensServico: vi.fn(),
      contarKpis: vi.fn(async () => KPIS_ZERADOS),
      alterarStatus: vi.fn(async (input) => ordem({ id: input.id, status: input.status })),
    };

    const resultado = await alterarStatusEmLote(gateway, ["os-1", "os-2"], "finalizado", "user-1");

    expect(resultado.sucesso).toEqual(["os-1", "os-2"]);
    expect(resultado.falhas).toEqual([]);
  });
});
