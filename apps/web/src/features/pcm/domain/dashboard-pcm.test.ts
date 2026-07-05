import { describe, expect, it } from "vitest";
import type { InspecaoResumo } from "../application/qualidade-gateway";
import { montarDashboardPcm } from "./dashboard-pcm";
import type { OrdemServicoOperacional } from "./ordens-servico";

const ordem = (patch: Partial<OrdemServicoOperacional>): OrdemServicoOperacional => ({
  id: "os",
  numero: "CH-001",
  titulo: "OS",
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
  createdAt: "2026-07-04T12:00:00Z",
  ...patch,
});

const inspecao = (dataInspecao: string): InspecaoResumo => ({
  id: dataInspecao,
  clientId: "cliente-1",
  clienteNome: "Cliente",
  titulo: "Inspeção",
  dataInspecao,
  responsavelTecnico: null,
  status: "em_andamento",
  observacoesGerais: null,
  totalItens: 0,
  itensConformes: 0,
  itensNaoConformes: 0,
  itensAtencao: 0,
});

describe("dashboard-pcm", () => {
  it("monta KPIs e listas a partir de OS/inspeções reais", () => {
    const dashboard = montarDashboardPcm(
      [
        ordem({ id: "a", numero: "CH-001", scorePcm: 20, createdAt: "2026-07-03T10:00:00Z" }),
        ordem({
          id: "b",
          numero: "CH-002",
          scorePcm: 125,
          prioridade: "critica",
          auvoTaskId: 123,
          createdAt: "2026-07-04T10:00:00Z",
        }),
        ordem({
          id: "c",
          numero: "CH-003",
          status: "finalizado",
          scorePcm: 90,
          createdAt: "2026-07-02T10:00:00Z",
        }),
      ],
      [inspecao("2026-07-04"), inspecao("2026-06-20")],
      new Date("2026-07-04T15:00:00Z"),
      {
        clientesAtivos: 4,
        clientesSincronizados: 3,
        clientesComEndereco: 2,
        clientesComContato: 1,
        tecnicosAtivos: 5,
        equipesTecnicas: 2,
        equipamentosAtivos: 10,
        equipamentosVinculados: 8,
        equipamentosSemCliente: 2,
        clientesComEquipamentos: 3,
        ultimaAtualizacao: "2026-07-04T12:00:00Z",
        topClientesEquipamentos: [{ auvoId: 100, nome: "Cliente", total: 6 }],
      },
    );

    expect(dashboard.kpis.find((kpi) => kpi.label === "OS Abertas")?.valor).toBe("2");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Maior Score")?.valor).toBe("125");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Inspeções (mês)")?.valor).toBe("1");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Clientes Auvo")?.valor).toBe("3");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Ativos Auvo")?.sub).toBe("8 vinculados");
    expect(dashboard.auvo?.topClientesEquipamentos[0]?.total).toBe(6);
    expect(dashboard.ordensRecentes.map((ordem) => ordem.id)).toEqual(["b", "a", "c"]);
    expect(dashboard.topBacklog.map((ordem) => ordem.id)).toEqual(["b", "a"]);
  });
});
