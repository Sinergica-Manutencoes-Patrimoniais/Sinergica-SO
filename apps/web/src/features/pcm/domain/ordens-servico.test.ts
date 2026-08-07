import { describe, expect, it } from "vitest";
import {
  FILTROS_ORDENS_VAZIO,
  agruparPorTecnico,
  auvoTaskDeepLink,
  calcularKpisOrdens,
  calcularMetricasOperacao,
  chamadoAbertoParaCard,
  deveAlterarStatusPorDrop,
  ehCardChamadoAberto,
  ehItemBacklog,
  filtrarBacklogGut,
  filtrarOrdens,
  formatarDiaIso,
  gerarDiasDoMes,
  ordenarBacklogGut,
  ordensNoDia,
  prioridadeColor,
  resumoTooltipOrdem,
  rotuloNumeroOrdem,
  statusOsColor,
} from "./ordens-servico";

const base = {
  id: "os",
  numero: "OS-0001",
  titulo: "Teste",
  descricao: null,
  clienteNome: "Cliente",
  categoria: "corretiva",
  prioridade: "media",
  gravidade: 3,
  urgencia: 3,
  tendencia: 3,
  dorCliente: null,
  observacao: null,
  origemInspecaoItemId: null,
  auvoTaskId: null,
  auvoSyncStatus: null,
  auvoSyncError: null,
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
};

describe("rotuloNumeroOrdem", () => {
  it("mantém CH-XXXX", () => {
    expect(rotuloNumeroOrdem({ numero: "CH-0041", auvoTaskId: 999 })).toBe("CH-0041");
  });
  it("troca OS-XXXX pelo ID do Auvo quando há task", () => {
    expect(rotuloNumeroOrdem({ numero: "OS-0067", auvoTaskId: 12345 })).toBe("Auvo #12345");
  });
  it("mantém o numero cru quando não é CH e não tem Auvo", () => {
    expect(rotuloNumeroOrdem({ numero: "OS-0067", auvoTaskId: null })).toBe("OS-0067");
  });
});

describe("auvoTaskDeepLink", () => {
  it("gera link apenas para task Auvo válida", () => {
    expect(auvoTaskDeepLink(123)).toBe("https://app.auvo.com.br/informacoes/tarefa/123");
    expect(auvoTaskDeepLink(null)).toBeNull();
    expect(auvoTaskDeepLink(0)).toBeNull();
    expect(auvoTaskDeepLink(-1)).toBeNull();
  });
});

describe("calcularMetricasOperacao", () => {
  it("conta backlog, sem técnico (aberta) e erro de sync Auvo", () => {
    const comum = { scorePcm: 27, createdAt: "2026-07-04T10:00:00Z" };
    const m = calcularMetricasOperacao([
      {
        ...base,
        ...comum,
        id: "1",
        status: "backlog",
        tecnicoFuncionarioId: null,
        auvoSyncError: null,
      },
      {
        ...base,
        ...comum,
        id: "2",
        status: "solicitacao",
        tecnicoFuncionarioId: null,
        auvoSyncError: null,
      },
      {
        ...base,
        ...comum,
        id: "3",
        status: "em_execucao",
        tecnicoFuncionarioId: "t1",
        auvoSyncError: "x",
      },
      {
        ...base,
        ...comum,
        id: "4",
        status: "finalizado",
        tecnicoFuncionarioId: null,
        auvoSyncError: null,
      },
    ]);
    // backlog: id 1. sem técnico (aberta): id 1 e 2 (finalizado não conta). erro sync: id 3.
    expect(m).toEqual({ backlog: 1, semTecnico: 2, syncAuvoErro: 1 });
  });
});

describe("chamadoAbertoParaCard", () => {
  it("mapeia pra card sintético na coluna Solicitação, com id nunca colidindo com OS real", () => {
    const card = chamadoAbertoParaCard(
      {
        id: "cham-1",
        numero: "CH-0099",
        titulo: "Vazamento",
        descricao: null,
        createdAt: "2026-07-29T10:00:00Z",
      },
      "Cliente X",
    );
    expect(card.status).toBe("solicitacao");
    expect(card.chamadoId).toBe("cham-1");
    expect(card.clienteNome).toBe("Cliente X");
    expect(ehCardChamadoAberto(card.id)).toBe(true);
    expect(ehCardChamadoAberto("os-real-uuid")).toBe(false);
  });
});

describe("ordens-servico", () => {
  it("ordena backlog por score desc e desempata por data mais recente", () => {
    const ordens = [
      { id: "a", scorePcm: 20, createdAt: "2026-07-03T10:00:00Z" },
      { id: "b", scorePcm: 90, createdAt: "2026-07-02T10:00:00Z" },
      { id: "c", scorePcm: 90, createdAt: "2026-07-04T10:00:00Z" },
    ];

    expect(ordenarBacklogGut(ordens).map((ordem) => ordem.id)).toEqual(["c", "b", "a"]);
  });

  it("backlog exclui status históricos", () => {
    const ordens = [
      { id: "a", status: "solicitacao", scorePcm: 20, createdAt: "2026-07-03T10:00:00Z" },
      { id: "b", status: "finalizado", scorePcm: 125, createdAt: "2026-07-04T10:00:00Z" },
      { id: "c", status: "cancelado", scorePcm: 90, createdAt: "2026-07-04T09:00:00Z" },
    ];

    expect(filtrarBacklogGut(ordens).map((ordem) => ordem.id)).toEqual(["a"]);
  });

  it("calcula KPIs operacionais", () => {
    expect(
      calcularKpisOrdens([
        { ...base, id: "1", status: "solicitacao", scorePcm: 27, createdAt: "2026-07-04" },
        {
          ...base,
          id: "2",
          status: "planejamento",
          prioridade: "critica",
          scorePcm: 125,
          createdAt: "2026-07-04",
        },
        { ...base, id: "3", status: "finalizado", scorePcm: 8, createdAt: "2026-07-04" },
      ]),
    ).toEqual({
      total: 3,
      abertas: 2,
      emPlanejamento: 1,
      emExecucao: 0,
      finalizadas: 1,
      criticas: 1,
    });
  });

  it("agrupa por técnico — 'Sem técnico' sempre por último", () => {
    const grupos = agruparPorTecnico([
      { ...base, id: "1", tecnicoFuncionarioId: "tec-2", tecnicoNome: "Weslei" },
      { ...base, id: "2", tecnicoFuncionarioId: null },
      { ...base, id: "3", tecnicoFuncionarioId: "tec-1", tecnicoNome: "Fabrício" },
      { ...base, id: "4", tecnicoFuncionarioId: "tec-1", tecnicoNome: "Fabrício" },
    ] as never);

    expect(grupos.map((g) => g.tecnicoNome)).toEqual(["Fabrício", "Weslei", "Sem técnico"]);
    expect(grupos[0]?.ordens.map((o) => o.id)).toEqual(["3", "4"]);
    expect(grupos[2]?.ordens.map((o) => o.id)).toEqual(["2"]);
  });

  it("ordensNoDia — filtra por dataAgendada no dia informado", () => {
    const ordens = [
      { ...base, id: "1", dataAgendada: "2026-06-25T08:00:00" },
      { ...base, id: "2", dataAgendada: "2026-06-25T18:30:00" },
      { ...base, id: "3", dataAgendada: "2026-06-26T08:00:00" },
      { ...base, id: "4", dataAgendada: null },
    ] as never;

    expect(ordensNoDia(ordens, "2026-06-25").map((o: { id: string }) => o.id)).toEqual(["1", "2"]);
  });

  it("E01-S42: filtrarOrdens — cada filtro isolado", () => {
    const ordens = [
      {
        ...base,
        id: "1",
        status: "solicitacao",
        categoria: "corretiva",
        tecnicoFuncionarioId: "tec-1",
        createdAt: "2026-07-01T10:00:00Z",
      },
      {
        ...base,
        id: "2",
        status: "planejamento",
        categoria: "preventiva",
        tecnicoFuncionarioId: "tec-2",
        createdAt: "2026-07-05T10:00:00Z",
      },
    ] as never;

    expect(
      filtrarOrdens(ordens, { ...FILTROS_ORDENS_VAZIO, status: "planejamento" }).map(
        (o: { id: string }) => o.id,
      ),
    ).toEqual(["2"]);
    expect(
      filtrarOrdens(ordens, { ...FILTROS_ORDENS_VAZIO, categoria: "corretiva" }).map(
        (o: { id: string }) => o.id,
      ),
    ).toEqual(["1"]);
    expect(
      filtrarOrdens(ordens, {
        ...FILTROS_ORDENS_VAZIO,
        tecnicoFuncionarioId: "tec-2",
      }).map((o: { id: string }) => o.id),
    ).toEqual(["2"]);
    expect(
      filtrarOrdens(ordens, { ...FILTROS_ORDENS_VAZIO, dataInicio: "2026-07-03" }).map(
        (o: { id: string }) => o.id,
      ),
    ).toEqual(["2"]);
  });

  it("E01-S42: filtrarOrdens — combina todos os filtros (E lógico)", () => {
    const ordens = [
      {
        ...base,
        id: "1",
        numero: "OS-0001",
        status: "planejamento",
        categoria: "corretiva",
        tecnicoFuncionarioId: "tec-1",
        createdAt: "2026-07-01T10:00:00Z",
      },
      {
        ...base,
        id: "2",
        numero: "OS-0002",
        status: "planejamento",
        categoria: "corretiva",
        tecnicoFuncionarioId: "tec-2",
        createdAt: "2026-07-01T10:00:00Z",
      },
    ] as never;

    expect(
      filtrarOrdens(ordens, {
        ...FILTROS_ORDENS_VAZIO,
        status: "planejamento",
        categoria: "corretiva",
        tecnicoFuncionarioId: "tec-1",
      }).map((o: { id: string }) => o.id),
    ).toEqual(["1"]);
  });

  it("gerarDiasDoMes — grade de 42 dias (6 semanas) começando no domingo", () => {
    const dias = gerarDiasDoMes(2026, 5); // junho/2026 (mês 0-indexado)
    expect(dias).toHaveLength(42);
    const primeiroDia = dias[0];
    if (!primeiroDia) throw new Error("gerarDiasDoMes devolveu array vazio");
    expect(primeiroDia.getDay()).toBe(0);
    expect(formatarDiaIso(primeiroDia)).toBe("2026-05-31");
  });

  it("E01-S59: tooltip resume identidade, técnico e descrição", () => {
    const resumo = resumoTooltipOrdem({
      ...base,
      status: "planejamento",
      scorePcm: 27,
      createdAt: "2026-07-04",
      descricao: "Trocar o disjuntor",
      tecnicoNome: "Fabrício",
    });

    expect(resumo).toContain("OS-0001 · Planejamento · Média");
    expect(resumo).toContain("Cliente: Cliente");
    expect(resumo).toContain("Técnico: Fabrício");
    expect(resumo).toContain("Trocar o disjuntor");
  });

  it("E01-S83 AC-4: tooltip inclui a Observação quando preenchida, omite quando vazia", () => {
    const comObservacao = resumoTooltipOrdem({
      ...base,
      status: "solicitacao",
      scorePcm: 3,
      createdAt: "2026-07-21",
      observacao: "Aguardando autorização do síndico",
    });
    expect(comObservacao).toContain("Observação: Aguardando autorização do síndico");

    const semObservacao = resumoTooltipOrdem({
      ...base,
      status: "solicitacao",
      scorePcm: 3,
      createdAt: "2026-07-21",
    });
    expect(semObservacao).not.toContain("Observação:");
  });

  it("E01-S83 AC-2: ehItemBacklog — só é backlog sem data/técnico/vínculo Auvo, e só enquanto aberta", () => {
    expect(
      ehItemBacklog({
        status: "solicitacao",
        dataAgendada: null,
        tecnicoFuncionarioId: null,
        auvoTaskId: null,
      }),
    ).toBe(true);

    expect(
      ehItemBacklog({
        status: "solicitacao",
        dataAgendada: "2026-07-25",
        tecnicoFuncionarioId: null,
        auvoTaskId: null,
      }),
    ).toBe(false);
    expect(
      ehItemBacklog({
        status: "solicitacao",
        dataAgendada: null,
        tecnicoFuncionarioId: "tec-1",
        auvoTaskId: null,
      }),
    ).toBe(false);
    expect(
      ehItemBacklog({
        status: "solicitacao",
        dataAgendada: null,
        tecnicoFuncionarioId: null,
        auvoTaskId: 42,
      }),
    ).toBe(false);
    expect(
      ehItemBacklog({
        status: "finalizado",
        dataAgendada: null,
        tecnicoFuncionarioId: null,
        auvoTaskId: null,
      }),
    ).toBe(false);
  });

  it("deveAlterarStatusPorDrop — E01-S61: só dispara quando origem e destino diferem", () => {
    expect(deveAlterarStatusPorDrop("planejamento", "em_execucao")).toBe(true);
    expect(deveAlterarStatusPorDrop("planejamento", "planejamento")).toBe(false);
    expect(deveAlterarStatusPorDrop("finalizado", "cancelado")).toBe(true);
  });
});

describe("statusOsColor / prioridadeColor — E00-S14 AC-3: só token, nunca hex", () => {
  const status = [
    "finalizado",
    "cancelado",
    "em_execucao",
    "planejamento",
    "backlog",
    "desconhecido",
  ];
  const prioridades = ["critica", "alta", "media", "normal", "desconhecida"];

  it.each(status)("statusOsColor(%s) não contém hex cru", (s) => {
    expect(statusOsColor(s)).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
  });

  it.each(prioridades)("prioridadeColor(%s) não contém hex cru", (p) => {
    expect(prioridadeColor(p)).not.toMatch(/#[0-9A-Fa-f]{3,8}/);
  });
});
