import { describe, expect, it } from "vitest";
import type { OrdemServicoOperacional } from "./ordens-servico";
import { formatarTextoRelatorioCliente, montarRelatorioCliente } from "./relatorio-cliente";

function os(parcial: Partial<OrdemServicoOperacional>): OrdemServicoOperacional {
  return {
    id: "os",
    numero: "CH-1",
    titulo: "Preventiva de ar-condicionado",
    descricao: "Filtro higienizado",
    clienteNome: "Condomínio Azul",
    categoria: "preventiva",
    status: "finalizado",
    prioridade: "normal",
    scorePcm: 0,
    gravidade: null,
    urgencia: null,
    tendencia: null,
    dorCliente: null,
    observacao: null,
    origemInspecaoItemId: null,
    auvoTaskId: 45,
    auvoSyncStatus: null,
    auvoSyncError: null,
    createdAt: "2026-08-01T12:00:00Z",
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
    ...parcial,
  };
}

describe("montarRelatorioCliente", () => {
  it("separa trabalho concluído do cronograma futuro e preserva evidência Auvo", () => {
    const relatorio = montarRelatorioCliente(
      { id: "cliente-1", nome: "Condomínio Azul" },
      "2026-08-01",
      "2026-08-31",
      [
        os({ checkOutAt: "2026-08-10T15:00:00Z" }),
        os({
          id: "os-2",
          titulo: "Visita programada",
          status: "planejamento",
          dataAgendada: "2026-09-10",
          auvoTaskId: null,
        }),
      ],
    );
    expect(relatorio.atividades).toHaveLength(1);
    expect(relatorio.atividades[0]?.evidenciaUrl).toContain("/45");
    expect(relatorio.cronograma).toEqual([expect.objectContaining({ data: "2026-09-10" })]);
    expect(formatarTextoRelatorioCliente(relatorio)).toContain("Preventiva de ar-condicionado");
  });

  it("expõe estados vazios sem inventar conteúdo", () => {
    const relatorio = montarRelatorioCliente(
      { id: "cliente-1", nome: "Condomínio Azul" },
      "2026-08-01",
      "2026-08-31",
      [],
    );
    expect(formatarTextoRelatorioCliente(relatorio)).toContain(
      "Sem atividades concluídas no período.",
    );
    expect(formatarTextoRelatorioCliente(relatorio)).toContain(
      "Sem preventivas ou visitas agendadas no momento.",
    );
  });

  it("inclui inspeção passada e visitas PMOC/agenda futuras do mesmo cliente", () => {
    const relatorio = montarRelatorioCliente(
      { id: "cliente-1", nome: "Condomínio Azul" },
      "2026-08-01",
      "2026-08-31",
      [],
      {
        atividades: [
          {
            numero: "INS-1",
            titulo: "Inspeção: Cobertura",
            descricao: "Sem infiltrações",
            data: "2026-08-12",
            evidenciaUrl: null,
          },
        ],
        cronograma: [
          {
            numero: "PMOC-1",
            titulo: "Preventiva PMOC: mensal",
            descricao: "Torre A",
            data: "2026-09-02",
            evidenciaUrl: null,
          },
          {
            numero: "AGENDA-1",
            titulo: "Visita técnica programada",
            descricao: "Ana Técnica",
            data: "2026-09-03",
            evidenciaUrl: null,
          },
        ],
      },
    );
    expect(relatorio.atividades).toEqual(
      expect.arrayContaining([expect.objectContaining({ numero: "INS-1" })]),
    );
    expect(relatorio.cronograma.map((item) => item.numero)).toEqual(["PMOC-1", "AGENDA-1"]);
  });
});
