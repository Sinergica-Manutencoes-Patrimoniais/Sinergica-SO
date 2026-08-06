import { describe, expect, it } from "vitest";
import type { InspecaoResumo } from "../application/qualidade-gateway";
import {
  consolidarSinaisCampoAuvo,
  mensagemErroSyncAuvoLegivel,
  montarCockpitBomDia,
  montarDashboardPcm,
} from "./dashboard-pcm";
import type { OrdemServicoOperacional } from "./ordens-servico";

const ordem = (patch: Partial<OrdemServicoOperacional>): OrdemServicoOperacional => ({
  id: "os",
  numero: "OS-0001",
  titulo: "OS",
  descricao: null,
  clienteNome: "Cliente",
  categoria: "corretiva",
  status: "solicitacao",
  prioridade: "media",
  scorePcm: 27,
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
  dorCliente: null,
  observacao: null,
  origemInspecaoItemId: null,
  auvoTaskId: null,
  auvoSyncStatus: null,
  auvoSyncError: null,
  createdAt: "2026-07-04T12:00:00Z",
  tecnicoFuncionarioId: null,
  tecnicoNome: null,
  dataAgendada: null,
  checkInAt: null,
  checkOutAt: null,
  detalhes: null,
  tipoOs: null,
  pmocScheduleId: null,
  chamadoId: null,
  localDescricao: null,
  solicitante: null,
  origem: "manual",
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
  codigo: null,
  tipoInspecaoId: null,
  tipoInspecaoNome: null,
  edificacao: null,
  endereco: null,
  horaInicio: null,
  horaFim: null,
  inspetor: null,
  responsavelNoLocal: null,
  escopo: null,
  normaTecnica: null,
  art: null,
  condicoes: null,
  anexos: [],
  eAssessment: false,
  motivoAssessment: null,
});

describe("dashboard-pcm", () => {
  it("mantém mensagem operacional e protege stack ou segredo", () => {
    expect(mensagemErroSyncAuvoLegivel("Cliente Auvo inexistente")).toBe(
      "Cliente Auvo inexistente",
    );
    expect(mensagemErroSyncAuvoLegivel("Bearer token-privado")).toBe(
      "Detalhe técnico protegido. Consulte os logs de sincronização.",
    );
    expect(mensagemErroSyncAuvoLegivel("Error: falhou at push (index.ts:12)")).toBe(
      "Detalhe técnico protegido. Consulte os logs de sincronização.",
    );
  });

  it("monta KPIs e listas a partir de OS/inspeções reais", () => {
    const dashboard = montarDashboardPcm(
      [
        ordem({ id: "a", numero: "OS-0001", scorePcm: 20, createdAt: "2026-07-03T10:00:00Z" }),
        ordem({
          id: "b",
          numero: "OS-0002",
          scorePcm: 125,
          prioridade: "critica",
          auvoTaskId: 123,
          createdAt: "2026-07-04T10:00:00Z",
        }),
        ordem({
          id: "c",
          numero: "OS-0003",
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
        campo: {
          execucoesRegistradas: 4,
          anexosRegistrados: 3,
          relatosRegistrados: 1,
          assinaturasRegistradas: 2,
          checklistsRecebidos: 2,
          pecasRegistradas: 1,
          controlesHoras: 2,
          osComEquipamentoVinculado: 2,
          ultimaExecucaoCampo: "2026-07-04T14:00:00Z",
        },
      },
    );

    expect(dashboard.kpis.find((kpi) => kpi.label === "OS Abertas")?.valor).toBe("2");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Maior Score")?.valor).toBe("125");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Inspeções (mês)")?.valor).toBe("1");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Clientes Auvo")?.valor).toBe("3");
    expect(dashboard.kpis.find((kpi) => kpi.label === "Ativos Auvo")?.sub).toBe("8 vinculados");
    expect(dashboard.auvo?.topClientesEquipamentos[0]?.total).toBe(6);
    expect(dashboard.auvo?.campo.checklistsRecebidos).toBe(2);
    expect(dashboard.ordensRecentes.map((ordem) => ordem.id)).toEqual(["b", "a", "c"]);
    expect(dashboard.topBacklog.map((ordem) => ordem.id)).toEqual(["b", "a"]);
  });

  it("consolida sinais de pull e webhook por OS sem duplicar", () => {
    const campo = consolidarSinaisCampoAuvo(
      [
        {
          ordemServicoId: "os-1",
          anexos: [{ id: 1 }],
          checklist: [{ id: 1 }],
          pecasConsumidas: [],
          controleHoras: {},
          checkinEm: "2026-07-10T09:00:00Z",
          concluidaEm: null,
          recebidoEm: "2026-07-10T09:01:00Z",
        },
        {
          ordemServicoId: null,
          anexos: [],
          checklist: [],
          pecasConsumidas: [{ id: 2 }],
          controleHoras: { total: 1 },
          checkinEm: null,
          concluidaEm: "2026-07-10T11:00:00Z",
          recebidoEm: null,
        },
      ],
      [
        {
          id: "os-1",
          detalhes: {
            anexos: [{ id: 1 }],
            relato: "Executado",
            assinaturaUrl: "https://arquivo",
            duracaoHoras: 2,
          },
          checkInAt: "2026-07-10T09:00:00Z",
          checkOutAt: "2026-07-10T10:00:00Z",
        },
        {
          id: "os-2",
          detalhes: { duracaoHoras: "0", produtos: [] },
          checkInAt: null,
          checkOutAt: null,
        },
      ],
      ["os-1", "os-1"],
    );

    expect(campo).toEqual({
      execucoesRegistradas: 2,
      anexosRegistrados: 1,
      relatosRegistrados: 1,
      assinaturasRegistradas: 1,
      checklistsRecebidos: 1,
      pecasRegistradas: 1,
      controlesHoras: 2,
      osComEquipamentoVinculado: 1,
      ultimaExecucaoCampo: "2026-07-10T11:00:00Z",
    });
  });

  it("monta leitura do dia com alocados, livres e chamados ainda sem tratativa", () => {
    const cockpit = montarCockpitBomDia("2026-08-06", {
      ordens: [
        ordem({
          id: "hoje",
          dataAgendada: "2026-08-06",
          tecnicoFuncionarioId: "ana",
          tecnicoNome: "Ana",
          clienteNome: "Condomínio Azul",
          localDescricao: "Casa de máquinas",
          tipoOs: "C1",
        }),
        ordem({ id: "atrasada", dataAgendada: "2026-08-05" }),
      ],
      chamados: [{ status: "aberto" } as never, { status: "backlog" } as never],
      tecnicos: [
        { id: "ana", nome: "Ana" },
        { id: "bia", nome: "Bia" },
      ],
      agenda: [],
      errosSyncAuvo: 2,
      inspecoesPendentes: 3,
      preventivas: [
        { scheduledDate: "2026-08-06", status: "agendado" },
        { scheduledDate: "2026-08-10", status: "atrasado" },
        { scheduledDate: "2026-08-17", status: "agendado" },
      ],
      reservasFerramenta: [
        { dataInicio: "2026-08-06", dataFim: "2026-08-06", status: "pendente" },
        { dataInicio: "2026-08-01", dataFim: "2026-08-05", status: "efetivada" },
        { dataInicio: "2026-08-01", dataFim: "2026-08-05", status: "cancelada" },
      ],
    });
    expect(cockpit.osHoje).toHaveLength(1);
    expect(cockpit.alocacoes).toEqual([
      { tecnicoNome: "Ana", clienteNome: "Condomínio Azul", local: "Casa de máquinas" },
    ]);
    expect(cockpit.tecnicosLivres).toEqual(["Bia"]);
    expect(cockpit).toMatchObject({
      chamadosSemTratativa: 1,
      emergenciaisAbertas: 1,
      osAtrasadas: 1,
      preventivasSemana: 1,
      ferramentasHoje: 1,
      ferramentasAtrasadas: 1,
      errosSyncAuvo: 2,
      inspecoesPendentes: 3,
    });
  });
});
