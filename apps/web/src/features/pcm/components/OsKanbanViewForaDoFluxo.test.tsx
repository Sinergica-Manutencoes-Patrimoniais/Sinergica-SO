// @vitest-environment jsdom
// Regressão achada em produção (24/11/2026): `E01-S194` removeu a coluna "Corretiva" apoiada num
// grep que concluiu "`corretiva` nunca foi escrito como status real". Havia uma OS real nesse
// status — `OS-0067`, "Vistoria técnica", cliente Portal Encantos de Parma. Sem coluna, o cartão
// sumia do quadro, porque o agrupamento é `ordem.status === coluna.id`.
//
// Estes testes travam a regra geral, não o caso específico: nenhuma OS desaparece do Kanban por
// ter um status que o fluxo aprovado não prevê.
import { TooltipProvider } from "@sinergica/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { COLUNAS_KANBAN_PADRAO, statusSemColuna } from "../domain/kanban-colunas";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import { OsKanbanView } from "./OsKanbanView";

function os(parcial: Partial<OrdemServicoOperacional>): OrdemServicoOperacional {
  return {
    id: "os-1",
    numero: "OS-0067",
    titulo: "Vistoria técnica",
    descricao: null,
    clienteNome: "Portal Encantos de Parma",
    categoria: "corretiva",
    status: "corretiva",
    prioridade: "normal",
    scorePcm: 0,
    gravidade: null,
    urgencia: null,
    tendencia: null,
    dorCliente: null,
    observacao: null,
    origemInspecaoItemId: null,
    auvoTaskId: 77430180,
    auvoSyncStatus: null,
    auvoSyncError: null,
    createdAt: "2026-07-27T12:00:00Z",
    tecnicoFuncionarioId: null,
    tecnicoNome: null,
    dataAgendada: null,
    checkInAt: null,
    checkOutAt: null,
    tipoOs: null,
    pmocScheduleId: null,
    chamadoId: null,
    clienteId: "cliente-1",
    ocorrenciaPreventivaId: null,
    ...parcial,
  } as OrdemServicoOperacional;
}

function montar(ordens: OrdemServicoOperacional[], onSelecionar = () => {}) {
  return render(
    <TooltipProvider>
      <OsKanbanView
        ordens={ordens}
        temEscrita
        salvando={false}
        onAlterarStatus={() => {}}
        onSelecionar={onSelecionar}
        colunas={COLUNAS_KANBAN_PADRAO}
        onMoverColuna={() => {}}
        onAlternarVisibilidadeColuna={() => {}}
        preventivas={[]}
      />
    </TooltipProvider>,
  );
}

describe("statusSemColuna", () => {
  it("acusa status que o quadro vigente não mostra", () => {
    expect(statusSemColuna(["corretiva", "planejamento"], COLUNAS_KANBAN_PADRAO)).toEqual([
      "corretiva",
    ]);
  });

  it("status do fluxo aprovado não é acusado", () => {
    expect(
      statusSemColuna(["solicitacao", "planejamento", "finalizado"], COLUNAS_KANBAN_PADRAO),
    ).toEqual([]);
  });

  it("coluna oculta pelo usuário também deixa a OS sem lugar", () => {
    const comPlanejamentoOculto = COLUNAS_KANBAN_PADRAO.map((c) =>
      c.id === "planejamento" ? { ...c, visivel: false } : c,
    );
    expect(statusSemColuna(["planejamento"], comPlanejamentoOculto)).toEqual(["planejamento"]);
  });

  it("não duplica status repetido", () => {
    expect(statusSemColuna(["corretiva", "corretiva"], COLUNAS_KANBAN_PADRAO)).toEqual([
      "corretiva",
    ]);
  });
});

describe("OsKanbanView — OS fora do fluxo (regressão de produção)", () => {
  it("a OS com status sem coluna NÃO some: aparece em 'Fora do fluxo'", () => {
    montar([os({})]);
    expect(screen.getByText("Fora do fluxo")).toBeInTheDocument();
    expect(screen.getByText("Vistoria técnica")).toBeInTheDocument();
  });

  it("avisa o operador, em texto, que existe OS fora do fluxo", () => {
    montar([os({})]);
    expect(screen.getByText(/1 OS está num status fora do fluxo aprovado/)).toBeInTheDocument();
  });

  it("sem OS órfã, nem o aviso nem a coluna aparecem", () => {
    montar([os({ id: "os-2", status: "planejamento" })]);
    expect(screen.queryByText("Fora do fluxo")).not.toBeInTheDocument();
    expect(screen.queryByText(/fora do fluxo aprovado/)).not.toBeInTheDocument();
  });

  it("clicar na OS órfã abre o detalhe — ela continua operável", async () => {
    const onSelecionar = vi.fn();
    montar([os({})], onSelecionar);
    await userEvent.click(screen.getByText("Vistoria técnica"));
    expect(onSelecionar).toHaveBeenCalledWith("os-1");
  });

  it("o aviso usa plural quando há mais de uma", () => {
    montar([os({}), os({ id: "os-3", numero: "OS-0068" })]);
    expect(screen.getByText(/2 OS estão em status fora do fluxo aprovado/)).toBeInTheDocument();
  });
});
